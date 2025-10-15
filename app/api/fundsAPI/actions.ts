"use server"
import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { toast } from "sonner"

export async function getFunds() {
    try {
        const get_funds = await prisma.funds.findMany()
        return get_funds
    } catch (error) {
        toast.error('Failed to fetch funds');
        return [];
    }
}

export async function uploadFund(fundName: string) {

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
        toast.success(`Fund ${upload_fund.fund_name} created successfully`);
    } else {
        toast.error('Fund already exists!');
    }
    revalidatePath('/dashboard/current-funds')
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