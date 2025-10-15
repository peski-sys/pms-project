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
            include: {
                sectors: {
                    select: {
                        sector_name: true,
                        instrument_type: true
                    }
                }
            }
        });
        return listed_securities
    } catch (error) {
        console.log('Failed to fetch listed securities');
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
                    console.log(`Failed to update ${stock.symbol}`);
                    errors.push(errorMsg);
                }
            }
        }
        
        if (errors.length > 0) {
            console.log(`Encountered ${errors.length} errors during update`);
        } else {
            console.log(`Successfully updated/inserted ${updatedCount} stock records`);
        }
        
        return {
            success: true,
            message: `Successfully refreshed stock listings. Updated/inserted ${updatedCount} stock records.`,
            updatedCount,
            errors: errors.length > 0 ? errors : null
        };
        
    } catch (error) {
        const errorMessage = `Stock data refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.log('Stock data refresh failed');
        
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
