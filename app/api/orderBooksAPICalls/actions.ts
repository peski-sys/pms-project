"use server";

import { prisma } from "@/lib/db"

type buy_result = {
    _sum: {
        quantity: number | null,
        txn_value: number | null,
        commission_amount: number | null,
        net_payable: number | null,
    },
    client_id: string,
    symbol: string
}


type sell_result = {
    _sum: {
        quantity: number | null,
        txn_value: number | null,
        commission_amount: number | null,
        net_receivable: number | null,
        approx_profit_loss: number | null,
        profit_loss: number | null,
    },
    client_id: string,
    symbol: string
}



async function groupByClientWithBrokerInfo<T extends buy_result | sell_result>(records: T[]) {
  const grouped: Record<string, { client_id: string, client_name: string, client_broker: number, symbols: T[] }> = {};

  for (const row of records) {
    if (!grouped[row.client_id]) {
      // Fetch broker information for this client
      const brokerInfo = await getClientBrokerName(row.client_id);
      grouped[row.client_id] = { 
        client_id: row.client_id, 
        client_name: brokerInfo?.client_name || '',
        client_broker: brokerInfo?.client_broker || 0,
        symbols: [] 
      };
    }
    grouped[row.client_id].symbols.push(row);
  }

  return Object.values(grouped);
}


export async function getOrderBooks() {
    const orders = await prisma.uploads.findMany({ 
        orderBy: {
            uploaded_at: {
                sort: "desc",
            }
        },
        include: {
            pdf_records: {
                select: {
                    dp_amount: true
                }
            }
        }
    });
    
    // Calculate total DP amount for each upload and convert to plain objects
    const ordersWithDpAmount = orders.map(order => ({
        upload_id: order.upload_id,
        file_name: order.file_name,
        uploaded_at: order.uploaded_at,
        is_confirmed: order.is_confirmed,
        total_dp_amount: order.pdf_records.reduce((total, pdf) => 
            total + Number(pdf.dp_amount || 0), 0
        )
    }));
    
    return ordersWithDpAmount;
}




export async function viewDataFor(given_upload_id: number) {

    const check_upload_id = await prisma.uploads.findUnique({
        where: {
            upload_id: given_upload_id
        },
        select: {
            is_confirmed: true,
        }
    })

    if(!check_upload_id?.is_confirmed) {

    const forBuys = await prisma.buy_records_staging.groupBy({
        by: ["client_id", "symbol"],
        _sum: {
            quantity: true,
            txn_value: true,
            commission_amount: true,
            net_payable: true,
        },
        where: {
            upload_id: given_upload_id,
        },
    })

    const sanitized_forbuys = forBuys.map((d) => ({
        ...d,
        _sum: {
            quantity: Number(d._sum.quantity),
            txn_value: Number(d._sum.txn_value),
            commission_amount: Number(d._sum.commission_amount),
            net_payable: Number(d._sum.net_payable)
        }
    }))

    const forSells = await prisma.sell_records_staging.groupBy({
        by: ["client_id", "symbol"],
        _sum: {
            quantity: true,
            txn_value: true,
            commission_amount: true,
            net_receivable: true,
            approx_profit_loss: true,
            profit_loss: true,
        },
        where: {
            upload_id: given_upload_id,
        }
    })
    const sanitized_forSells = forSells.map((d) => ({
        ...d,
        _sum: {
            quantity: Number(d._sum.quantity),
            txn_value: Number(d._sum.txn_value),
            commission_amount: Number(d._sum.commission_amount),
            net_receivable: Number(d._sum.net_receivable),
            approx_profit_loss: Number(d._sum.approx_profit_loss),
            profit_loss: Number(d._sum.profit_loss)
        }
    }))

    const buying = await groupByClientWithBrokerInfo<buy_result>(sanitized_forbuys);
    const selling = await groupByClientWithBrokerInfo<sell_result>(sanitized_forSells);
    return {buying, selling}
}
    else {

    const forBuys = await prisma.buy_records.groupBy({
        by: ["client_id", "symbol"],
        _sum: {
            quantity: true,
            txn_value: true,
            commission_amount: true,
            net_payable: true,
        },
        where: {
            upload_id: given_upload_id,
        },
    })

    const sanitized_forbuys = forBuys.map((d) => ({
        ...d,
        _sum: {
            quantity: Number(d._sum.quantity),
            txn_value: Number(d._sum.txn_value),
            commission_amount: Number(d._sum.commission_amount),
            net_payable: Number(d._sum.net_payable)
        }
    }))

    const forSells = await prisma.sell_records.groupBy({
        by: ["client_id", "symbol"],
        _sum: {
            quantity: true,
            txn_value: true,
            commission_amount: true,
            net_receivable: true,
            approx_profit_loss: true,
            profit_loss: true,
        },
        where: {
            upload_id: given_upload_id,
        }
    })
    const sanitized_forSells = forSells.map((d) => ({
        ...d,
        _sum: {
            quantity: Number(d._sum.quantity),
            txn_value: Number(d._sum.txn_value),
            commission_amount: Number(d._sum.commission_amount),
            net_receivable: Number(d._sum.net_receivable),
            approx_profit_loss: Number(d._sum.approx_profit_loss),
            profit_loss: Number(d._sum.profit_loss)
        }
    }))

    const buying = await groupByClientWithBrokerInfo<buy_result>(sanitized_forbuys);
    const selling = await groupByClientWithBrokerInfo<sell_result>(sanitized_forSells);

    return {buying, selling}

    }
}



export async function getClientBrokerName(given_client_id: string) {
    const details = await prisma.client_broker_mapping.findUnique({
        where: {
            client_id: given_client_id
        },
    })
    return details
}
