"use server"
import { prisma } from "@/lib/db";
import { FinancialCalculator } from "@/lib/decimalUtils";
import { revalidatePath } from "next/cache";


type outputStructure = {
  "CONTRACT NO": string,
  "CLIENT": string,
  "SYMBOL": string,
  "TYPE": string,
  "QTY": number,
  "PRICE": number,
  "VALUE": number,
  "TRADE TIME": Date,
}

type parsing_buy = {
    contract_number: string,
    commission_rate: string,
    commission_amount: number,
    sebon_commission: number,
    effective_rate: number,
    net_payable: number,
}

type overallBuy = {
    "transactions": parsing_buy[],
    "dp_amount": number,
}

type parsing_sell = {
    contract_number: string,
    commission_rate: string,
    commission_amount: number,
    capital_gain_tax: number,
    sebon_commission: number,
    effective_rate: number,
    net_receivable: number,
    profit_loss: number,
    approx_profit_loss: number,
}

type overallSell = {
    "transactions": parsing_sell[],
    "dp_amount": number,
}

type status_response = {
  "STATUS": string,
}

const microservice_url = process.env.MICROSERVICE_URL

export async function fileSubmitted(file: File[] | null) {
    try {
        if (!file) {
            return { success: false, error: 'No files provided' };
        }

        if (!microservice_url) {
            return { success: false, error: 'Microservice URL not configured' };
        }

        const results = [];
        
        // Separate files by type to ensure Excel files are processed first
        const excelFiles = file.filter(f => f.name.endsWith(".xlsx"));
        const pdfFiles = file.filter(f => f.name.endsWith(".pdf"));
        
        // Process ALL Excel files first
        for(const forExcel of excelFiles) {
            const formDataExcel = new FormData();
            try {
                formDataExcel.append("file", forExcel);

                const response = await fetch(`${microservice_url}/parseExcelFile/`, {
                    method: "POST",
                    body: formDataExcel,
                });

                if (!response.ok) {
                    throw new Error(`Microservice returned ${response.status}: ${response.statusText}`);
                }

                const final_excel: outputStructure[] = await response.json();

                if (!final_excel || final_excel.length === 0) {
                    throw new Error('No data received from Excel parsing');
                }

                // Create upload record
                const uploadRecord = await prisma.uploads.create({
                    data: { file_name: forExcel.name },
                });

                try {
                    // Validate client IDs before insertion
                    const uniqueClientIds = [...new Set(final_excel.map(row => String(row["CLIENT"])))];
                    
                    // Check which client IDs exist in client_broker_mapping
                    const existingClients = await prisma.client_broker_mapping.findMany({
                        where: {
                            client_id: {
                                in: uniqueClientIds
                            }
                        },
                        select: {
                            client_id: true,
                            client_name: true
                        }
                    });
                    
                    const existingClientIds = existingClients.map(c => c.client_id);
                    const missingClientIds = uniqueClientIds.filter(id => !existingClientIds.includes(id));
                    
                    if (missingClientIds.length > 0) {
                        throw new Error(`Client IDs not found in database: ${missingClientIds.join(', ')}. Please ensure these clients are registered in the system first.`);
                    }
                    
                    // Get fiscal year mapping for each transaction date
                    const fiscalYearMapping = new Map<string, number>();
                    
                    for (const row of final_excel) {
                        const transactionDate = new Date(row["TRADE TIME"]);
                        const dateKey = transactionDate.toDateString();
                        
                        if (!fiscalYearMapping.has(dateKey)) {
                            const fiscalYear = await prisma.fiscal_years.findFirst({
                                where: {
                                    start_date: {
                                        lte: transactionDate
                                    },
                                    end_date: {
                                        gte: transactionDate
                                    }
                                },
                                select: {
                                    fiscal_year_id: true
                                }
                            });
                            
                            if (fiscalYear) {
                                fiscalYearMapping.set(dateKey, fiscalYear.fiscal_year_id);
                            }
                        }
                    }
                    
                    // Insert order book records
                    await prisma.order_book.createMany({
                        data: final_excel.map((row) => {
                            const transactionDate = new Date(row["TRADE TIME"]);
                            const dateKey = transactionDate.toDateString();
                            const fiscalYearId = fiscalYearMapping.get(dateKey) || null;
                            
                            return {
                                upload_id: uploadRecord.upload_id,
                                contract_number: String(row["CONTRACT NO"]),
                                client_id: String(row["CLIENT"]),
                                symbol: row["SYMBOL"],
                                transaction_type: row["TYPE"],
                                quantity: row["QTY"],
                                price: row["PRICE"],
                                txn_value: row["VALUE"],
                                transaction_date: transactionDate,
                                fiscal_year_id: fiscalYearId,
                            };
                        }),
                    });

                    revalidatePath('/dashboard/order-books');

                    // Create audit log
                    await prisma.audit_log.create({
                        data: {
                            performed_action: `Uploaded new File: ${forExcel.name}`,
                        },
                    });

                    results.push({ file: forExcel.name, status: 'success', type: 'excel' });

                } catch (dbError) {
                    // Clean up upload record on failure
                    try {
                        await prisma.uploads.delete({
                            where: { upload_id: uploadRecord.upload_id }
                        });
                    } catch (deleteError) {
                        // Cleanup failed, but continue processing
                    }
                    
                    results.push({ 
                        file: forExcel.name, 
                        status: 'error', 
                        type: 'excel',
                        error: dbError instanceof Error ? dbError.message : 'Database error' 
                    });
                }

            } catch (fileError) {
                results.push({ 
                    file: forExcel.name, 
                    status: 'error', 
                    type: 'excel',
                    error: fileError instanceof Error ? fileError.message : 'File processing error'
                });
            }
        }

        // Process ALL PDF files after Excel files are completely processed
        for(const forPDF of pdfFiles) {
            const formDataPDF = new FormData();
            try {
                formDataPDF.append("file", forPDF);

                    // Get PDF status
                    const statusResponse = await fetch(`${microservice_url}/status/`, {
                        method: "POST",
                        body: formDataPDF,
                    });

                    if (!statusResponse.ok) {
                        throw new Error(`Status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
                    }

                    const final_response: status_response = await statusResponse.json();

                    if (!final_response || !final_response.STATUS) {
                        throw new Error('Invalid status response from microservice');
                    }

                    if(final_response.STATUS === "BUY") {
                        try {
                            const response = await fetch(`${microservice_url}/parseBUYData/`, {
                                method: "POST",
                                body: formDataPDF,
                            });

                            if (!response.ok) {
                                throw new Error(`BUY data parsing failed: ${response.status}`);
                            }

                            const final_data: overallBuy = await response.json();

                            if (!final_data || final_data["transactions"].length === 0) {
                                throw new Error('No BUY data received from PDF parsing');
                            }

                            // Check if data already exists by looking at first record's commission_rate
                            const first_contract = final_data["transactions"][0];
                            const find_first_order = await prisma.order_book.findUnique({
                                where: { contract_number: first_contract.contract_number },
                                include: {
                                    uploads: { select: { is_confirmed: true, upload_id: true } }
                                }
                            });

                            if (!find_first_order) {
                                throw new Error(`First order book record not found for contract: ${first_contract.contract_number}`);
                            }

                            const upload_id = find_first_order.upload_id;
                            let data_already_exists = false;

                            // Check if commission data already exists
                            if (find_first_order.uploads.is_confirmed) {
                                const existing_buy_record = await prisma.buy_records.findUnique({
                                    where: { contract_number: first_contract.contract_number }
                                });
                                data_already_exists = existing_buy_record?.commission_rate !== "" && existing_buy_record?.commission_rate !== null;
                            } else {
                                const existing_staging_record = await prisma.buy_records_staging.findUnique({
                                    where: { contract_number: first_contract.contract_number }
                                });
                                data_already_exists = existing_staging_record?.commission_rate !== "" && existing_staging_record?.commission_rate !== null;
                            }

                            // Create or update PDF record if data doesn't exist
                            if (!data_already_exists) {
                                // Check if PDF record already exists for this upload_id
                                const existingPdfRecord = await prisma.pdf_records.findFirst({
                                    where: { upload_id: upload_id }
                                });

                                if (existingPdfRecord) {
                                    // Update existing PDF record
                                    await prisma.pdf_records.update({
                                        where: { pdf_id: existingPdfRecord.pdf_id },
                                        data: {
                                            dp_amount: final_data.dp_amount || 0,
                                            is_confirmed: false
                                        }
                                    });
                                } else {
                                    // Create new PDF record
                                    await prisma.pdf_records.create({
                                        data: {
                                            upload_id: upload_id,
                                            dp_amount: final_data.dp_amount || 0,
                                            is_confirmed: false
                                        }
                                    });
                                }

                                // Process all transactions
                                for (const details of final_data["transactions"]) {
                                    try {
                                        const find_check = await prisma.order_book.findUnique({
                                            where: { contract_number: details.contract_number },
                                            include: {
                                                uploads: { select: { is_confirmed: true } }
                                            }
                                        });

                                        if (!find_check) {
                                            continue;
                                        }

                                        if (find_check.uploads.is_confirmed) {
                                            await prisma.buy_records.update({
                                                where: { contract_number: details.contract_number },
                                                data: {
                                                    commission_rate: details.commission_rate,
                                                    commission_amount: details.commission_amount,
                                                    sebon_commission: details.sebon_commission,
                                                    effective_rate: details.effective_rate,
                                                    net_payable: details.net_payable,
                                                },
                                            });
                                        } else {
                                            await prisma.buy_records_staging.update({
                                                where: { contract_number: details.contract_number },
                                                data: {
                                                    commission_rate: details.commission_rate,
                                                    commission_amount: details.commission_amount,
                                                    sebon_commission: details.sebon_commission,
                                                    effective_rate: details.effective_rate,
                                                    net_payable: details.net_payable,
                                                },
                                            });
                                        }
                                    } catch (recordError) {
                                        // Continue processing other records
                                    }
                                }

                                // Mark PDF record as confirmed after processing
                                const pdfRecordToConfirm = await prisma.pdf_records.findFirst({
                                    where: { upload_id: upload_id }
                                });
                                
                                if (pdfRecordToConfirm) {
                                    await prisma.pdf_records.update({
                                        where: { pdf_id: pdfRecordToConfirm.pdf_id },
                                        data: { is_confirmed: true }
                                    });
                                }
                            }
                        } catch (buyError) {
                            throw buyError;
                        }
                    }
                    else if(final_response.STATUS === "SELL") {
                        try {
                            const response = await fetch(`${microservice_url}/parseSELLData/`, {
                                method: "POST",
                                body: formDataPDF,
                            });

                            if (!response.ok) {
                                throw new Error(`SELL data parsing failed: ${response.status}`);
                            }

                            const final_data: overallSell = await response.json();

                            if (!final_data || final_data["transactions"].length === 0) {
                                throw new Error('No SELL data received from PDF parsing');
                            }

                            // Check if data already exists by looking at first record's commission_rate
                            const first_contract = final_data["transactions"][0];
                            const find_first_order = await prisma.order_book.findUnique({
                                where: { contract_number: first_contract.contract_number },
                                include: {
                                    uploads: { select: { is_confirmed: true, upload_id: true } }
                                }
                            });

                            if (!find_first_order) {
                                throw new Error(`First order book record not found for contract: ${first_contract.contract_number}`);
                            }

                            const upload_id = find_first_order.upload_id;
                            let data_already_exists = false;

                            // Check if commission data already exists
                            if (find_first_order.uploads.is_confirmed) {
                                const existing_sell_record = await prisma.sell_records.findUnique({
                                    where: { contract_number: first_contract.contract_number }
                                });
                                data_already_exists = existing_sell_record?.commission_rate !== "" && existing_sell_record?.commission_rate !== null;
                            } else {
                                const existing_staging_record = await prisma.sell_records_staging.findUnique({
                                    where: { contract_number: first_contract.contract_number }
                                });
                                data_already_exists = existing_staging_record?.commission_rate !== "" && existing_staging_record?.commission_rate !== null;
                            }

                            // Create or update PDF record if data doesn't exist
                            if (!data_already_exists) {
                                // Check if PDF record already exists for this upload_id
                                const existingPdfRecord = await prisma.pdf_records.findFirst({
                                    where: { upload_id: upload_id }
                                });

                                if (existingPdfRecord) {
                                    // Update existing PDF record
                                    await prisma.pdf_records.update({
                                        where: { pdf_id: existingPdfRecord.pdf_id },
                                        data: {
                                            dp_amount: final_data.dp_amount || 0,
                                            is_confirmed: false
                                        }
                                    });
                                } else {
                                    // Create new PDF record
                                    await prisma.pdf_records.create({
                                        data: {
                                            upload_id: upload_id,
                                            dp_amount: final_data.dp_amount || 0,
                                            is_confirmed: false
                                        }
                                    });
                                }

                                // Process all transactions
                                for (const details of final_data["transactions"]) {
                                    try {
                                        const find_check = await prisma.order_book.findUnique({
                                            where: { contract_number: details.contract_number },
                                            include: {
                                                uploads: { select: { is_confirmed: true } }
                                            }
                                        });

                                        if (!find_check) {
                                            continue;
                                        }

                                        if (find_check.uploads.is_confirmed) {
                                            await prisma.sell_records.update({
                                                where: { contract_number: details.contract_number },
                                                data: {
                                                    commission_rate: details.commission_rate,
                                                    commission_amount: details.commission_amount,
                                                    sebon_commission: details.sebon_commission,
                                                    capital_gain_tax: details.capital_gain_tax,
                                                    effective_rate: details.effective_rate,
                                                    net_receivable: details.net_receivable,
                                                },
                                            });
                                        } else {
                                            await prisma.sell_records_staging.update({
                                                where: { contract_number: details.contract_number },
                                                data: {
                                                    commission_rate: details.commission_rate,
                                                    commission_amount: details.commission_amount,
                                                    sebon_commission: details.sebon_commission,
                                                    capital_gain_tax: details.capital_gain_tax,
                                                    effective_rate: details.effective_rate,
                                                    net_receivable: details.net_receivable,
                                                },
                                            });
                                        }
                                    } catch (recordError) {
                                        // Continue processing other records
                                    }
                                }

                                // Mark PDF record as confirmed after processing
                                const pdfRecordToConfirm = await prisma.pdf_records.findFirst({
                                    where: { upload_id: upload_id }
                                });
                                
                                if (pdfRecordToConfirm) {
                                    await prisma.pdf_records.update({
                                        where: { pdf_id: pdfRecordToConfirm.pdf_id },
                                        data: { is_confirmed: true }
                                    });
                                }
                            }
                        } catch (sellError) {
                            throw sellError;
                        }
                    }

                    results.push({ file: forPDF.name, status: 'success', type: 'pdf', pdfType: final_response.STATUS });

                } catch (pdfError) {
                    results.push({ 
                        file: forPDF.name, 
                        status: 'error', 
                        type: 'pdf',
                        error: pdfError instanceof Error ? pdfError.message : 'PDF processing error'
                    });
                }
        }

        return { success: true, results };

    } catch (error) {
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            results: []
        };
    }
}

type shareType = {
  scrips: Record<string, string>,  // key = symbol, value = quantity
  boid: string,
}

export async function uploadDEMAT(file: File[] | null) {
    try {
        if (!file) {
            return { success: false, error: 'No files provided' };
        }

        if (!microservice_url) {
            return { success: false, error: 'Microservice URL not configured' };
        }

        const results = [];

        for(const forPDF of file) {
            try {
                const formDataPDF = new FormData();
                formDataPDF.append("file", forPDF);

                const statusResponse = await fetch(`${microservice_url}/getShareValues/`, {
                    method: "POST",
                    body: formDataPDF,
                });

                if (!statusResponse.ok) {
                    throw new Error(`DEMAT parsing failed: ${statusResponse.status} ${statusResponse.statusText}`);
                }

                const final_response: shareType = await statusResponse.json();

                if (!final_response || !final_response.boid || !final_response.scrips) {
                    throw new Error('Invalid DEMAT data received from microservice');
                }

                // Get client information
                const getClient = await prisma.client_boid_mapping.findUnique({
                    where: { boid: final_response.boid }
                });

                if (!getClient) {
                    throw new Error(`Client not found for BOID: ${final_response.boid}`);
                }

                const getFundID = await prisma.client_broker_mapping.findMany({
                    where: { boid: final_response.boid }
                });

                if (!getFundID || getFundID.length === 0) {
                    throw new Error(`Fund mapping not found for BOID: ${final_response.boid}`);
                }

                const extracted_fund_id = getFundID[0].fund_id;
                let updatedSymbols = 0;

                // Get current fiscal year ID
                const currentDate = new Date();
                const currentFiscalYear = await prisma.fiscal_years.findFirst({
                    where: {
                        start_date: {
                            lte: currentDate
                        },
                        end_date: {
                            gte: currentDate
                        }
                    },
                    select: {
                        fiscal_year_id: true
                    }
                });
                
                if (!currentFiscalYear) {
                    throw new Error('No current fiscal year found for DEMAT upload');
                }
                
                const fiscalYearId = currentFiscalYear.fiscal_year_id;

                // Update fiscal year balance instead of symbol holdings
                for (const [symbol, qty] of Object.entries(final_response.scrips)) {
                    try {
                        await prisma.fiscal_year_balance.update({
                            data: { demat: Number(qty) },
                            where: {
                                client_id_symbol_fiscal_year_id: {
                                    client_id: getClient.client_id,
                                    symbol: symbol,
                                    fiscal_year_id: fiscalYearId,
                                },
                            },
                        });
                        updatedSymbols++;
                    } catch (updateError) {
                        // Continue with other symbols rather than failing completely
                    }
                }

                results.push({
                    file: forPDF.name,
                    status: 'success',
                    boid: final_response.boid,
                    symbolsUpdated: updatedSymbols,
                    totalSymbols: Object.keys(final_response.scrips).length
                });

            } catch (fileError) {
                results.push({
                    file: forPDF.name,
                    status: 'error',
                    error: fileError instanceof Error ? fileError.message : 'DEMAT processing error'
                });
            }
        }

        return { success: true, results };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            results: []
        };
    }
}



export async function confirmSubmission(given_upload_id: number) {
    try {
        if (!given_upload_id || given_upload_id <= 0) {
            return { success: false, error: 'Invalid upload ID provided' };
        }

        // First check if the upload exists and is not already confirmed
        const uploadExists = await prisma.uploads.findUnique({
            where: { upload_id: given_upload_id },
            select: { upload_id: true, is_confirmed: true, file_name: true }
        });

        if (!uploadExists) {
            throw new Error(`Upload with ID ${given_upload_id} not found`);
        }

        if (uploadExists.is_confirmed) {
            return { success: true, message: 'Upload already confirmed', alreadyConfirmed: true };
        }

        // Execute the staging records confirmation procedure
        await prisma.$executeRaw`SELECT confirm_staging_records(${given_upload_id}::INT)`;

        // Update the upload status
        await prisma.uploads.update({
            data: { is_confirmed: true },
            where: { upload_id: given_upload_id },
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Confirmed upload submission: ${uploadExists.file_name} (ID: ${given_upload_id})`,
            },
        });

        return { 
            success: true, 
            message: 'Upload confirmed successfully',
            uploadId: given_upload_id,
            fileName: uploadExists.file_name
        };

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to confirm submission',
            uploadId: given_upload_id
        };
    }
}
