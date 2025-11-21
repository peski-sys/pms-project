"use server"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"

export async function getFunds() {
    try {
        const get_funds = await prisma.funds.findMany()
        return { success: true, data: get_funds }
    } catch (error) {
        console.error('Failed to fetch funds:', error);
        return { success: false, error: 'Failed to fetch funds', data: [] };
    }
}

export async function uploadFund(fundName: string) {
    try {
        const doesExist = await prisma.funds.findMany({
            where: {
                fund_name: fundName.toUpperCase(),
            }
        })

        if(doesExist.length === 0) {
            const upload_fund = await prisma.funds.create( { 
                data: {
                    fund_name: fundName.toUpperCase(),
                }
            } )

            await prisma.audit_log.create({
                data: {
                    performed_action: `Created New Fund: ${upload_fund.fund_name}`
                }
            })
            
            revalidatePath('/dashboard/current-funds')
            return { success: true, message: `Fund ${upload_fund.fund_name} created successfully` };
        } else {
            return { success: false, error: 'Fund already exists!' };
        }
    } catch (error) {
        console.error('Failed to upload fund:', error);
        return { success: false, error: 'Failed to create fund' };
    }
}

export async function fetchClientsFor(currentFund: string) {
    const selected = await prisma.client_broker_mapping.findMany({
        where: {
            funds: {
                fund_name: currentFund
            }
        }
    })
    return selected
}