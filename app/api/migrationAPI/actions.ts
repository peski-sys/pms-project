"use server"
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

type outputStructure = {
    "UPLOAD_ID": string,
  "CONTRACT NO": string,
  "CLIENT": string,
  "SYMBOL": string,
  "TYPE": string,
  "QTY": number,
  "PRICE": number,
  "VALUE": number,
  "TRADE TIME": Date,
}

const microservice_url = process.env.MICROSERVICE_URL

export async function fileSubmittedMigration(file: File | null) {
    try {
        if (!file) {
            console.error('No files provided to fileSubmitted function');
            return { success: false, error: 'No files provided' };
        }

        if (!microservice_url) {
            console.error('MICROSERVICE_URL is not configured');
            return { success: false, error: 'Microservice URL not configured' };
        }

        const results = [];
        const formDataExcel = new FormData();
                try {
                    formDataExcel.append("file", file);

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

                    try {
                        // Insert order book records
                        await prisma.order_book.createMany({
                            data: final_excel.map((row) => ({
                                upload_id: Number(row["UPLOAD_ID"]),
                                contract_number: String(row["CONTRACT NO"]),
                                client_id: String(row["CLIENT"]),
                                symbol: row["SYMBOL"],
                                transaction_type: row["TYPE"],
                                quantity: row["QTY"],
                                price: row["PRICE"],
                                txn_value: row["VALUE"],
                                transaction_date: new Date(row["TRADE TIME"]),
                            })),
                        });

                        revalidatePath('/dashboard/order-books');

                        // Create audit log
                        await prisma.audit_log.create({
                            data: {
                                performed_action: `Uploaded new File: ${file.name}`,
                            },
                        });

                        results.push({ file: file.name, status: 'success', type: 'excel', message: `Successfully processed Excel file: ${file.name}` });

                    } catch (dbError) {
                        console.error(`Database error while processing ${file.name}:`, dbError);
                        
                        // Clean up upload record on failure
                        try {
                            await prisma.uploads.delete({
                                where: { upload_id: Number(final_excel[0]["UPLOAD_ID"]) }
                            });
                        } catch (deleteError) {
                            console.error(`Failed to clean up upload record for ${file.name}:`, deleteError);
                        }
                        
                        results.push({ 
                            file: file.name, 
                            status: 'error', 
                            type: 'excel',
                            error: dbError instanceof Error ? dbError.message : 'Database error' 
                        });
                    }

                } catch (fileError) {
                    console.error(`Error processing Excel file ${file.name}:`, fileError);
                    results.push({ 
                        file: file.name, 
                        status: 'error', 
                        type: 'excel',
                        error: fileError instanceof Error ? fileError.message : 'File processing error'
                    });
                }

        return { success: true, results };

    } catch (error) {
        console.error('Critical error in fileSubmitted function:', error);
        return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            results: []
        };
    }
}

export async function confirmSubmissionMigration(given_upload_id: number) {
    try {
        if (!given_upload_id || given_upload_id <= 0) {
            console.error('Invalid upload ID provided to confirmSubmission');
            return { success: false, error: 'Invalid upload ID provided' };
        }

        // Create audit log for confirmation process
        await prisma.audit_log.create({
            data: {
                performed_action: `Migration confirmation initiated for upload ID: ${given_upload_id}`
            }
        });

        // First check if the upload exists and is not already confirmed
        const uploadExists = await prisma.uploads.findUnique({
            where: { upload_id: given_upload_id },
            select: { upload_id: true, is_confirmed: true, file_name: true }
        });

        if (!uploadExists) {
            throw new Error(`Upload with ID ${given_upload_id} not found`);
        }

        if (uploadExists.is_confirmed) {
            console.warn(`Upload ${given_upload_id} is already confirmed`);
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

        // Create success audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Migration confirmation completed successfully for upload ID: ${given_upload_id}`
            }
        });
        return { 
            success: true, 
            message: 'Upload confirmed successfully',
            uploadId: given_upload_id,
            fileName: uploadExists.file_name
        };

    } catch (error) {
        console.error(`Error confirming submission for upload ID ${given_upload_id}:`, error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to confirm submission',
            uploadId: given_upload_id
        };
    }
}
