"use server"
import { prisma } from "@/lib/db"


const microservice_url = process.env.MICROSERVICE_URL

type chukul_data = {
    id: number,
    symbol: string,
    name: string,
    sector_id: number,
    type: string,
}

export async function getListed() {
    try {
        const listed_securities = await prisma.stock_fulls.findMany({
            select: {
                symbol: true,
                full_form: true,
                sector_id: true,
                promoter_sector_id: true,
                is_auto_generated: true,
                sectors: {
                    select: {
                        sector_name: true,
                        instrument_type: true
                    }
                }
            }
        });
        
        // Get all unique promoter sector IDs
        const promoterSectorIds = listed_securities
            .filter(stock => stock.promoter_sector_id && stock.promoter_sector_id !== 0)
            .map(stock => stock.promoter_sector_id!)
            .filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates
        
        // Fetch all promoter sectors in one query
        const promoterSectors = promoterSectorIds.length > 0
            ? await prisma.sectors.findMany({
                where: {
                    sector_id: { in: promoterSectorIds }
                },
                select: {
                    sector_id: true,
                    sector_name: true,
                    instrument_type: true
                }
            })
            : [];
        
        // Create a map for quick lookup
        const promoterSectorMap = new Map(
            promoterSectors.map(sector => [sector.sector_id, sector])
        );
        
        // Map stocks with promoter sector details
        const stocksWithPromoterSectors = listed_securities.map((stock) => {
            if (stock.promoter_sector_id && stock.promoter_sector_id !== 0) {
                const promoterSector = promoterSectorMap.get(stock.promoter_sector_id);
                return {
                    ...stock,
                    promoter_sector: promoterSector ? {
                        sector_name: promoterSector.sector_name,
                        instrument_type: promoterSector.instrument_type
                    } : null
                };
            }
            return {
                ...stock,
                promoter_sector: null
            };
        });
        
        return stocksWithPromoterSectors
    } catch (error) {
        // Return empty array on error - this is a non-critical operation
        return [];
    }
}



export async function getNewData() {
    try {
        
        // Fetch new data from microservice
        const getting_data = await fetch(`${microservice_url}/refreshSymbolInfo`);
        
        if (!getting_data.ok) {
            throw new Error(`Failed to fetch data from microservice: ${getting_data.status} ${getting_data.statusText}`);
        }
        
        const final_data: chukul_data[] = await getting_data.json();
        
        if (!Array.isArray(final_data)) {
            throw new Error('Invalid data format received from microservice');
        }
        
        // Update/Insert stock listings only (upsert approach)
        let updatedCount = 0;
        const errors = [];
        
        for(let stock of final_data) {
            if(stock.sector_id) {
                try {
                    // Use upsert to either update existing or create new stock record
                    await prisma.stock_fulls.upsert({
                        where: {
                            symbol: stock.symbol,
                            is_auto_generated: true
                        },
                        update: {
                            full_form: stock.name,
                            sector_id: stock.sector_id
                        },
                        create: {
                            symbol: stock.symbol,
                            full_form: stock.name,
                            sector_id: stock.sector_id
                        }
                    });
                    
                    // Check if this was an update or insert by querying if it existed before
                    // Since upsert doesn't tell us, we'll just count all as updated for simplicity
                    updatedCount++;
                } catch (error) {
                    const errorMsg = `Failed to update/insert ${stock.symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    errors.push(errorMsg);
                }
            }
        }
        
        // Create audit log for stock data refresh
        await prisma.audit_log.create({
            data: {
                performed_action: `Stock data refresh completed: ${updatedCount} updated, ${errors.length} errors`
            }
        });
        
        return {
            success: true,
            message: `Successfully refreshed stock listings. Updated/inserted ${updatedCount} stock records.`,
            updatedCount,
            errors: errors.length > 0 ? errors : null
        };
        
    } catch (error) {
        const errorMessage = `Stock data refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        // Log error to audit trail
        await prisma.audit_log.create({
            data: {
                performed_action: `Stock data refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            }
        });
        
        return {
            success: false,
            message: errorMessage,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Get all sectors for autocomplete
export async function getSectors(query?: string) {
    try {
        const sectors = await prisma.sectors.findMany({
            where: query ? {
                sector_name: {
                    contains: query,
                    mode: 'insensitive'
                }
            } : {},
            select: {
                sector_id: true,
                sector_name: true,
                instrument_type: true
            },
            take: 20, // Limit to 20 suggestions
            orderBy: {
                sector_name: 'asc'
            }
        });
        
        return sectors;
    } catch (error) {
        console.error('Error fetching sectors:', error);
        return [];
    }
}

// Add new stock with is_auto_generated = false
export async function addNewStock(symbol: string, fullForm: string, sectorId: number) {
    try {
        // Validate inputs
        if (!symbol || !fullForm || !sectorId) {
            return {
                success: false,
                message: 'All fields are required'
            };
        }

        // Check if stock already exists
        const existingStock = await prisma.stock_fulls.findUnique({
            where: {
                symbol: symbol.toUpperCase()
            }
        });

        if (existingStock) {
            return {
                success: false,
                message: `Stock with symbol ${symbol.toUpperCase()} already exists`
            };
        }

        // Verify sector exists
        const sector = await prisma.sectors.findUnique({
            where: {
                sector_id: sectorId
            }
        });

        if (!sector) {
            return {
                success: false,
                message: 'Invalid sector selected'
            };
        }

        // Create new stock
        const newStock = await prisma.stock_fulls.create({
            data: {
                symbol: symbol.toUpperCase(),
                full_form: fullForm,
                sector_id: sectorId,
                is_auto_generated: false // Set to false for manually added stocks
            }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Added new stock manually: ${symbol.toUpperCase()} - ${fullForm} (Sector: ${sector.sector_name})`
            }
        });

        return {
            success: true,
            message: `Stock ${symbol.toUpperCase()} added successfully`,
            data: {
                symbol: newStock.symbol,
                full_form: newStock.full_form,
                sector_name: sector.sector_name,
                instrument_type: sector.instrument_type
            }
        };
        
    } catch (error) {
        console.error('Error adding new stock:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to add stock'
        };
    }
}

/**
 * Update promoter sector ID for a stock
 */
export async function updatePromoterSector(symbol: string, promoterSectorId: number | null) {
    try {
        // Validate inputs
        if (!symbol) {
            return {
                success: false,
                message: 'Symbol is required'
            };
        }

        // Check if stock exists
        const existingStock = await prisma.stock_fulls.findUnique({
            where: {
                symbol: symbol.toUpperCase()
            }
        });

        if (!existingStock) {
            return {
                success: false,
                message: `Stock with symbol ${symbol.toUpperCase()} not found`
            };
        }

        // If promoterSectorId is provided, verify it exists
        if (promoterSectorId !== null && promoterSectorId !== 0) {
            const promoterSector = await prisma.sectors.findUnique({
                where: {
                    sector_id: promoterSectorId
                }
            });

            if (!promoterSector) {
                return {
                    success: false,
                    message: 'Invalid promoter sector selected'
                };
            }
        }

        // Update promoter sector
        await prisma.stock_fulls.update({
            where: {
                symbol: symbol.toUpperCase()
            },
            data: {
                promoter_sector_id: promoterSectorId === 0 ? null : promoterSectorId
            }
        });

        // Create audit log
        const sectorName = promoterSectorId && promoterSectorId !== 0 
            ? (await prisma.sectors.findUnique({ where: { sector_id: promoterSectorId }, select: { sector_name: true } }))?.sector_name || 'Unknown'
            : 'None';
        
        await prisma.audit_log.create({
            data: {
                performed_action: `Updated promoter sector for ${symbol.toUpperCase()} to ${sectorName}`
            }
        });

        return {
            success: true,
            message: `Promoter sector updated successfully for ${symbol.toUpperCase()}`
        };
        
    } catch (error) {
        console.error('Error updating promoter sector:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to update promoter sector'
        };
    }
}
