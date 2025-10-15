"use server"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { toast } from "sonner"

export async function getFiscal() {
    try {
        const fiscal_details = await prisma.fiscal_years.findMany({
            orderBy: {
                fiscal_year_id: 'asc'
            }
        })
        return fiscal_details
    } catch (error) {
        toast.error('Failed to fetch fiscal years');
        return [];
    }
}


export async function uploadFiscal(given_year_label: string, given_start_date: Date, given_end_date: Date) {
    try {
        await prisma.fiscal_years.create({
            data: {
                year_label: given_year_label,
                start_date: given_start_date,
                end_date: given_end_date,
            }
        })
        revalidatePath('/dashboard/fiscal-year-mapping')
        toast.success(`Fiscal year ${given_year_label} created successfully`);
    } catch (error) {
        toast.error('Failed to create fiscal year');
        throw error;
    }
}

export async function syncInitialBalance(currentFiscalYearId: number) {
    try {
        const fromYear = currentFiscalYearId - 1;
        const toYear = currentFiscalYearId;
        
        // Call the PostgreSQL function using raw query
        const result = await prisma.$queryRaw`
            SELECT carryforward_fiscal_year_balance(${fromYear}, ${toYear}) as result
        `;
        
        // Update initial_balance_synced to true after successful sync
        await prisma.fiscal_years.update({
            where: {
                fiscal_year_id: toYear
            },
            data: {
                initial_balance_synced: true
            }
        });
        
        revalidatePath('/dashboard/fiscal-year-mapping');
        
        // Extract the result message from the function
        const message = (result as any)[0]?.result || 'Initial balance sync completed successfully';
        
        return {
            success: true,
            message: message
        };
    } catch (error) {
        console.error('Sync initial balance error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Failed to sync initial balance'
        };
    }
}
