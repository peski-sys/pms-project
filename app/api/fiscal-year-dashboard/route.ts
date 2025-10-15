import { NextRequest, NextResponse } from "next/server";
import { 
    getCurrentFiscalYear,
    getAllFiscalYears,
    getTotalInvestmentFiscal,
    getUnrealizedGainsFiscal,
    getRealizedGainsFiscal,
    getInvestmentBreakdownFiscal,
    getSectorPortfolioSummaryFiscal
} from "@/app/api/fiscalYearDashboardAPI/actions";

export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const selectUser = url.searchParams.get("selectUser");
    const fiscalYearId = url.searchParams.get("fiscalYearId");

    try {
        switch (action) {
            case "getCurrentFiscalYear":
                const currentFiscalYear = await getCurrentFiscalYear();
                return NextResponse.json({
                    success: true,
                    data: currentFiscalYear
                });

            case "getAllFiscalYears":
                const allFiscalYears = await getAllFiscalYears();
                return NextResponse.json({
                    success: true,
                    data: allFiscalYears
                });

            case "getTotalInvestmentFiscal":
                if (!selectUser || !fiscalYearId) {
                    return NextResponse.json({
                        success: false,
                        error: "selectUser and fiscalYearId are required"
                    }, { status: 400 });
                }

                const totalInvestment = await getTotalInvestmentFiscal(selectUser, parseInt(fiscalYearId));
                return NextResponse.json({
                    success: true,
                    data: totalInvestment
                });

            case "getUnrealizedGainsFiscal":
                if (!selectUser || !fiscalYearId) {
                    return NextResponse.json({
                        success: false,
                        error: "selectUser and fiscalYearId are required"
                    }, { status: 400 });
                }

                const unrealizedGains = await getUnrealizedGainsFiscal(selectUser, parseInt(fiscalYearId));
                return NextResponse.json({
                    success: true,
                    data: unrealizedGains
                });

            case "getRealizedGainsFiscal":
                if (!selectUser || !fiscalYearId) {
                    return NextResponse.json({
                        success: false,
                        error: "selectUser and fiscalYearId are required"
                    }, { status: 400 });
                }

                const realizedGains = await getRealizedGainsFiscal(selectUser, parseInt(fiscalYearId));
                return NextResponse.json({
                    success: true,
                    data: realizedGains
                });

            case "getInvestmentBreakdownFiscal":
                if (!selectUser || !fiscalYearId) {
                    return NextResponse.json({
                        success: false,
                        error: "selectUser and fiscalYearId are required"
                    }, { status: 400 });
                }

                const investmentBreakdown = await getInvestmentBreakdownFiscal(selectUser, parseInt(fiscalYearId));
                return NextResponse.json({
                    success: true,
                    data: investmentBreakdown
                });

            case "getSectorPortfolioSummaryFiscal":
                if (!selectUser || !fiscalYearId) {
                    return NextResponse.json({
                        success: false,
                        error: "selectUser and fiscalYearId are required"
                    }, { status: 400 });
                }

                const sectorPortfolioSummary = await getSectorPortfolioSummaryFiscal(selectUser, parseInt(fiscalYearId));
                return NextResponse.json({
                    success: true,
                    data: sectorPortfolioSummary
                });

            default:
                return NextResponse.json({
                    success: false,
                    error: "Invalid action specified"
                }, { status: 400 });
        }
    } catch (error) {
        console.error("Error in fiscal year dashboard API:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Internal server error"
        }, { status: 500 });
    }
}