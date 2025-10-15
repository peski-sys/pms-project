"use server"


const microservice_url = process.env.MICROSERVICE_URL


export async function fetchStockInformation(stockName: string) {
    try {
        const response = await fetch(`${microservice_url}/getStockInformation/${stockName}`)
        
        const returned_data: any = await response.json()
        
        // Return the data as-is (could be valid data or { status: 'error' })

        const sanitized_data = returned_data.map((d: any) => ({
            ...d,
            ltp: Number(returned_data.ltp),
        }))
        return sanitized_data
    } catch (error) {
        console.error('Error fetching stock information:', error)
        return { status: 'error' }
    }
}
