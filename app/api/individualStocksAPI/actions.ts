"use server"

import { prisma } from "@/lib/db"

export async function getForStock(shorts: string) {
    const fetchValue = await prisma.stock_fulls.findUnique({
        where: {
            symbol: shorts.toUpperCase(),
        }
    })

    if(fetchValue) {
        return fetchValue
    } else {
        return ''
    }
}