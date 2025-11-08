"use server"

import { prisma } from "@/lib/db";
import { toast } from "sonner";


export async function getBrokerClientData() {
    try {
        const mapping = await prisma.client_broker_mapping.findMany({
            orderBy: {
                fund_id: "asc",
            },
            select: {
                client_id: true,
                fund_id: true,
                client_name: true,
                client_broker: true,
                recorded_at: true,
                boid: true,
                client_boid_mapping_client_broker_mapping_boidToclient_boid_mapping: {
                    select: {
                        dp_name: true
                    }
                }
            }
        });
        
        // Transform the data to include dp_name at the top level
        return mapping.map(item => ({
            client_id: item.client_id,
            fund_id: item.fund_id,
            client_name: item.client_name,
            client_broker: item.client_broker,
            recorded_at: item.recorded_at,
            boid: item.boid,
            dp_name: item.client_boid_mapping_client_broker_mapping_boidToclient_boid_mapping?.dp_name || null
        }));
    } catch (error) {
        toast.error("Failed to fetch broker client data");
        throw error;
    }
}

export async function uploadNewClient(formData: FormData, selectValue: string) {
    const given_fund_id = Number(selectValue);
    const given_client_name = formData.get("client-name") as string;
    const given_client_broker = Number(formData.get("client-broker"));
    const given_client_id = formData.get("client-id") as string;
    const given_client_dp_name = formData.get("client-dp-name") as string;
    const given_client_boid = formData.get("client-boid") as string;

    const checkClient = await prisma.client_broker_mapping.findUnique ( {
        where: {
            client_id: given_client_id,
        }
    } )

    if(!checkClient) {

    await prisma.client_boid_mapping.create( {
        data: {
            client_id: String(given_client_id),
            boid: given_client_boid,
            dp_name: given_client_dp_name,
        }
    })

    await prisma.client_broker_mapping.create( {
        data: {
            fund_id: given_fund_id,
            client_id: String(given_client_id),
            boid: given_client_boid,
            client_name: given_client_name,
            client_broker: Number(given_client_broker),
        }
    })

    await prisma.audit_log.create( {
        data: {
            performed_action: `Created new Client and DP: ${given_client_id}, ${given_client_name}, ${given_client_broker}`
        }
    } )
    toast.success(`Client created successfully: ${given_client_name}`);
    } else {
        toast.error("Client already exists!");
    }
}