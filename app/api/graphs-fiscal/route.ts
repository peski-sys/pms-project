import { NextRequest, NextResponse } from "next/server";
import { 
    getSectorAllocationFiscal,
    getDividendInfoFiscal,
    getPortfolioGainersLosersFiscal,
    getInvestmentHighlightsFiscal,
    getComprehensivePortfolioFiscal
} from "@/app/api/graphsPageFiscalAPI/actions";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const selectUser = url.searchParams.get("selectUser");
    const fiscalYearId = url.searchParams.get("fiscalYearId");

    try {
        if (!selectUser || !fiscalYearId) {
            return NextResponse.json({
                success: false,
                error: "selectUser and fiscalYearId are required"
            }, { status: 400 });
        }

        const fiscalYear = parseInt(fiscalYearId);

        switch (action) {
            case "getSectorAllocation":
                const sectorData = await getSectorAllocationFiscal(selectUser, fiscalYear);
                return NextResponse.json({
                    success: true,
                    data: sectorData
                });

            case "getDividendInfo":
                const dividendData = await getDividendInfoFiscal(selectUser, fiscalYear);
                return NextResponse.json({
                    success: true,
                    data: dividendData
                });

            case "getPortfolioGainersLosers":
                const gainersLosersData = await getPortfolioGainersLosersFiscal(selectUser, fiscalYear);
                return NextResponse.json({
                    success: true,
                    data: gainersLosersData
                });

            case "getInvestmentHighlights":
                const highlightsData = await getInvestmentHighlightsFiscal(selectUser, fiscalYear);
                return NextResponse.json({
                    success: true,
                    data: highlightsData
                });

            case "getComprehensivePortfolio":
                const portfolioData = await getComprehensivePortfolioFiscal(selectUser, fiscalYear);
                return NextResponse.json({
                    success: true,
                    data: portfolioData
                });

            case "getAllData":
                const [allSectorData, allDividendData, allGainersLosersData, allHighlightsData, allPortfolioData] = await Promise.all([
                    getSectorAllocationFiscal(selectUser, fiscalYear),
                    getDividendInfoFiscal(selectUser, fiscalYear),
                    getPortfolioGainersLosersFiscal(selectUser, fiscalYear),
                    getInvestmentHighlightsFiscal(selectUser, fiscalYear),
                    getComprehensivePortfolioFiscal(selectUser, fiscalYear)
                ]);
                
                return NextResponse.json({
                    success: true,
                    data: {
                        sectorAllocation: allSectorData,
                        dividendInfo: allDividendData,
                        portfolioGainersLosers: allGainersLosersData,
                        investmentHighlights: allHighlightsData,
                        comprehensivePortfolio: allPortfolioData
                    }
                });

            default:
                return NextResponse.json({
                    success: false,
                    error: "Invalid action specified"
                }, { status: 400 });
        }
    } catch (error) {
        console.error("Error in graphs fiscal API:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}