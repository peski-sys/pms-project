"use server"

type BasicInfo = {
  openPrice: number
  highPrice: number
  lowPrice: number
  totalTradeQuantity: number
  totalTradeValue: number
  lastTradedPrice: number
  perChange: number
  schange: string
  lastUpdatedDateTime: string
  lastUpdatedDate: string
  totalTrades: number
  previousClose: number
  marketCapitalization: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  averageTradedPrice: number
  companyName: string
  symbol: string
  instrumentType: string
  public: string
  promoter: string
  companyEmail: string
  sectorName: string
  cap_type: string | null
}

type ReportInfo = {
  name: string
  avg: number
  ratio_value: number
}

type stockInfoType = {
  basicInfo: BasicInfo
  reportInfo: ReportInfo[]
}

const microservice_url = process.env.MICROSERVICE_URL


export async function fetchStockInformation(stockName: string): Promise<stockInfoType | { status: 'error' }> {
  try {
    const response = await fetch(`${microservice_url}/getStockInformation/${stockName}`)
    const data: any = await response.json()

    // Check if the API returned an error
    if (data.status === 'error') {
      return { status: 'error' }
    }

    // Convert numeric strings to numbers in basicInfo if needed
    const sanitized_data: stockInfoType = {
      basicInfo: {
        ...data.basicInfo,
        openPrice: Number(data.basicInfo.openPrice),
        highPrice: Number(data.basicInfo.highPrice),
        lowPrice: Number(data.basicInfo.lowPrice),
        totalTradeQuantity: Number(data.basicInfo.totalTradeQuantity),
        totalTradeValue: Number(data.basicInfo.totalTradeValue),
        lastTradedPrice: Number(data.basicInfo.lastTradedPrice),
        perChange: Number(data.basicInfo.perChange),
        totalTrades: Number(data.basicInfo.totalTrades),
        previousClose: Number(data.basicInfo.previousClose),
        marketCapitalization: Number(data.basicInfo.marketCapitalization),
        fiftyTwoWeekHigh: Number(data.basicInfo.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: Number(data.basicInfo.fiftyTwoWeekLow),
        averageTradedPrice: Number(data.basicInfo.averageTradedPrice),
        public: String(data.basicInfo.public),
        promoter: String(data.basicInfo.promoter),
      },
      reportInfo: data.reportInfo.map((item: any) => ({
        name: item.name,
        avg: Number(item.avg),
        ratio_value: Number(item.ratio_value),
      })),
    }

    return sanitized_data

  } catch (error) {
    console.error('Error fetching stock information:', error)
    return { status: 'error' }
  }
}

