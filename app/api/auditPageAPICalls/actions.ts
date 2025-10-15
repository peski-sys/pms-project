"use server"

import { prisma } from "@/lib/db";

export async function viewAudits() {
    const audit_history = await prisma.audit_log.findMany({ 
        orderBy: {
            date_time: "desc",
        }
     })
    return audit_history
}