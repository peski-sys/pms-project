"use server"

import { prisma } from "@/lib/db";

type filterData = {
    name: string,
    c_id: string,
    t_type: string,
    s_symbol: string,
    start_date: Date | undefined,
    end_date: Date | undefined,
}


const microservice_url = process.env.MICROSERVICE_URL

export async function passFilters(incomingData: filterData) {
    // Build where clause properly handling dates
    const whereClause: any = {}
    
    if (incomingData.c_id) whereClause.client_id = incomingData.c_id
    if (incomingData.t_type) whereClause.transaction_type = incomingData.t_type
    if (incomingData.s_symbol) whereClause.symbol = incomingData.s_symbol
    if (incomingData.name) whereClause.client_broker_mapping = { client_name: incomingData.name }
    
    // Handle date filtering properly
    if (incomingData.start_date && incomingData.end_date) {
        whereClause.transaction_date = {
            gte: incomingData.start_date,
            lte: incomingData.end_date
        }
    } else if (incomingData.start_date) {
        whereClause.transaction_date = {
            gte: incomingData.start_date
        }
    } else if (incomingData.end_date) {
        whereClause.transaction_date = {
            lte: incomingData.end_date
        }
    }
    
    const results = await prisma.order_book.findMany({
    where: whereClause,
include: {
    client_broker_mapping: true,
},

orderBy: {
    transaction_date: "desc",
}


}); 
    const sanitized_data = results.map((d) => ({
        ...d,
        upload_id: Number(d.upload_id),
        quantity: Number(d.quantity),
        price: Number(d.price),
        txn_value: Number(d.txn_value),
    }))
    return sanitized_data;
}


export async function getHeroDetails(incomingData: filterData) {
    // Build where clause for buy records
    const buyWhereClause: any = {}
    if (incomingData.c_id) buyWhereClause.client_id = incomingData.c_id
    if (incomingData.s_symbol) buyWhereClause.symbol = incomingData.s_symbol
    if (incomingData.name) buyWhereClause.client_broker_mapping = { client_name: incomingData.name }
    
    // Handle date filtering for buy records
    if (incomingData.start_date && incomingData.end_date) {
        buyWhereClause.transaction_date = {
            gte: incomingData.start_date,
            lte: incomingData.end_date
        }
    } else if (incomingData.start_date) {
        buyWhereClause.transaction_date = {
            gte: incomingData.start_date
        }
    } else if (incomingData.end_date) {
        buyWhereClause.transaction_date = {
            lte: incomingData.end_date
        }
    }
    
    const buy_results = await prisma.buy_records.aggregate({

    _sum: {
        txn_value: true,
        commission_amount: true,
    },
    
    where: buyWhereClause,



});


// Build where clause for sell records  
    const sellWhereClause: any = {}
    if (incomingData.c_id) sellWhereClause.client_id = incomingData.c_id
    if (incomingData.s_symbol) sellWhereClause.symbol = incomingData.s_symbol
    if (incomingData.name) sellWhereClause.client_broker_mapping = { client_name: incomingData.name }
    
    // Handle date filtering for sell records
    if (incomingData.start_date && incomingData.end_date) {
        sellWhereClause.transaction_date = {
            gte: incomingData.start_date,
            lte: incomingData.end_date
        }
    } else if (incomingData.start_date) {
        sellWhereClause.transaction_date = {
            gte: incomingData.start_date
        }
    } else if (incomingData.end_date) {
        sellWhereClause.transaction_date = {
            lte: incomingData.end_date
        }
    }
    
    const sell_results = await prisma.sell_records.aggregate({

    _sum: {
        txn_value: true,
        profit_loss: true,
    },
    
    where: sellWhereClause,



});

    // Get DP amounts from pdf_records based on uploads related to the filtered transactions
    const upload_ids_from_buy = await prisma.buy_records.findMany({
        where: buyWhereClause,
        select: { upload_id: true },
        distinct: ['upload_id']
    });
    
    const upload_ids_from_sell = await prisma.sell_records.findMany({
        where: sellWhereClause,
        select: { upload_id: true },
        distinct: ['upload_id']
    });
    
    // Combine all unique upload IDs
    const all_upload_ids = [...new Set([
        ...upload_ids_from_buy.map(record => record.upload_id),
        ...upload_ids_from_sell.map(record => record.upload_id)
    ])];
    
    // Get total DP amount from pdf_records
    const dp_results = await prisma.pdf_records.aggregate({
        _sum: {
            dp_amount: true
        },
        where: {
            upload_id: { in: all_upload_ids },
            is_confirmed: true
        }
    });

return {
    fromBuy: {
            txn_value: Number(buy_results["_sum"]["txn_value"]),
            expected_commission: Number(buy_results["_sum"]["commission_amount"])
    },
    fromSell: {
            txn_value: Number(sell_results["_sum"]["txn_value"]),
            profit_loss: Number(sell_results["_sum"]["profit_loss"]),
    },
    dpAmount: Number(dp_results["_sum"]["dp_amount"] || 0)
}
}

export async function getClientNameID() {
    const clientDetails = await prisma.client_broker_mapping.findMany();

    console.log(clientDetails);
    return clientDetails
}


export async function getUsersFor(c_name: string) {
    const selectedUsers = await prisma.client_broker_mapping.findMany({
        where: {
            client_name: c_name,
        }
    });
    return selectedUsers
}

export async function exportExcel(incomingData: filterData) {
const results = await prisma.order_book.findMany({
    where: {
    ...(incomingData.c_id && { client_id: incomingData.c_id }),
    ...(incomingData.t_type && { transaction_type: incomingData.t_type }),
    ...(incomingData.s_symbol && { symbol: incomingData.s_symbol }),
    ...(incomingData.start_date && { transaction_date: { gte: incomingData.start_date } }),
    ...(incomingData.end_date && { transaction_date: { lte: incomingData.end_date } }),
    ...(incomingData.name && {
      client_broker_mapping: { client_name: incomingData.name }
    }),
},
include: {
    client_broker_mapping: true,
},

orderBy: {
    transaction_date: "desc",
}

});

    const send_json = await fetch(`${microservice_url}/downloadToExcel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(results)
    })

}