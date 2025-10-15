import { NextRequest, NextResponse } from "next/server";
import { 
    getMetricDataTradingFiscal,
    getMetricDataPromoterFiscal
} from "@/app/api/secondDashboardFiscalAPI/actions";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const currentFund = url.searchParams.get("currentFund");
    const fiscalID = url.searchParams.get("fiscalID");

    try {
        if (!currentFund || !fiscalID) {
            return NextResponse.json({
                success: false,
                error: "currentFund and fiscalID are required"
            }, { status: 400 });
        }

        switch (action) {
            case "getTradingData":
                const tradingData = await getMetricDataTradingFiscal(currentFund, fiscalID);
                return NextResponse.json({
                    success: true,
                    data: tradingData
                });

            case "getPromoterData":
                const promoterData = await getMetricDataPromoterFiscal(currentFund, fiscalID);
                return NextResponse.json({
                    success: true,
                    data: promoterData
                });

            case "getAllData":
                const [allTradingData, allPromoterData] = await Promise.all([
                    getMetricDataTradingFiscal(currentFund, fiscalID),
                    getMetricDataPromoterFiscal(currentFund, fiscalID)
                ]);
                
                return NextResponse.json({
                    success: true,
                    data: {
                        trading: allTradingData,
                        promoter: allPromoterData
                    }
                });

            default:
                return NextResponse.json({
                    success: false,
                    error: "Invalid action specified. Use 'getTradingData', 'getPromoterData', or 'getAllData'"
                }, { status: 400 });
        }
    } catch (error) {
        console.error("Error in second dashboard fiscal API:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}