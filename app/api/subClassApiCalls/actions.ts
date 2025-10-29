"use server"

import { prisma } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { toast } from "sonner"

export async function getSubClasses() {
    try {
        const subClasses = await prisma.sub_classes.findMany({
            include: {
                funds: {
                    select: {
                        fund_name: true
                    }
                },
                _count: {
                    select: {
                        fiscal_year_balance: true,
                        symbol_holdings: true
                    }
                }
            },
            orderBy: {
                added_at: 'desc'
            }
        })
        return subClasses
    } catch (error) {
        console.error('Error fetching sub classes:', error)
        return []
    }
}

export async function createSubClass(fundId: number, subName: string) {
    try {
        if (!fundId || !subName || subName.trim() === '') {
            throw new Error('Fund ID and Sub Class name are required')
        }

        // Check if sub class already exists for this fund
        const existingSubClass = await prisma.sub_classes.findFirst({
            where: {
                fund_id: fundId,
                sub_name: subName.trim().toUpperCase()
            }
        })

        if (existingSubClass) {
            throw new Error('Sub class already exists for this fund')
        }

        // Get fund name for audit log
        const fund = await prisma.funds.findUnique({
            where: { fund_id: fundId },
            select: { fund_name: true }
        })

        if (!fund) {
            throw new Error('Fund not found')
        }

        const newSubClass = await prisma.sub_classes.create({
            data: {
                fund_id: fundId,
                sub_name: subName.trim().toUpperCase()
            }
        })

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Created Sub Class: ${newSubClass.sub_name} for Fund: ${fund.fund_name}`
            }
        })

        revalidatePath('/dashboard/sub-class')
        return { success: true, message: 'Sub class created successfully' }
    } catch (error) {
        console.error('Error creating sub class:', error)
        const message = error instanceof Error ? error.message : 'Failed to create sub class'
        return { success: false, message }
    }
}

export async function getFunds() {
    try {
        const funds = await prisma.funds.findMany({
            select: {
                fund_id: true,
                fund_name: true
            },
            orderBy: {
                fund_name: 'asc'
            }
        })
        return funds
    } catch (error) {
        console.error('Error fetching funds:', error)
        return []
    }
}

