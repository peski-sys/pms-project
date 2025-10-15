"use client"

import {
  Card,
  CardContent,
} from "@/components/ui/card"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { viewAudits } from "@/app/api/auditPageAPICalls/actions"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { Pagination } from "./ui/pagination"

type forAudit = {
    performed_action: string,
    date_time: Date | null,
    audit_id: number,
}

export function AuditLayout() {
    const [audits, setAudits] = useState<forAudit[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const fetchAudits = async () => {
        setIsLoading(true);
        try {
            const auditData: forAudit[] = await viewAudits();
            setAudits(auditData);
        } catch (error) {
            console.error('Error fetching audits:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAudits();
    }, []);

    const todayCount = audits.filter(audit => {
        if (!audit.date_time) return false
        const today = new Date()
        const auditDate = new Date(audit.date_time)
        return auditDate.toDateString() === today.toDateString()
    }).length

    const thisWeekCount = audits.filter(audit => {
        if (!audit.date_time) return false
        const now = new Date()
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()))
        const auditDate = new Date(audit.date_time)
        return auditDate >= weekStart
    }).length
    
    // Pagination calculations
    const totalPages = Math.ceil(audits.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const paginatedAudits = audits.slice(startIndex, startIndex + itemsPerPage)

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Logs</p>
                            <p className="text-2xl font-bold text-gray-900">{audits.length}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Today</p>
                            <p className="text-2xl font-bold text-gray-900">{todayCount}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3a4 4 0 118 0v4m-8 9v2h8v-2M8 7v8M8 7H6M8 15H6m8-8h2m0 0h2m-2 0V5m2 2h2" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">This Week</p>
                            <p className="text-2xl font-bold text-gray-900">{thisWeekCount}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Latest Action</p>
                            <p className="text-lg font-bold text-gray-900">
                                {audits.length > 0 
                                    ? audits.sort((a, b) => {
                                        const dateA = a.date_time ? new Date(a.date_time) : new Date(0)
                                        const dateB = b.date_time ? new Date(b.date_time) : new Date(0)
                                        return dateB.getTime() - dateA.getTime()
                                    })[0]?.performed_action?.substring(0, 20) + (audits[0]?.performed_action?.length > 20 ? '...' : '') || 'None'
                                    : 'None'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end mb-6">
                <Button 
                    onClick={fetchAudits} 
                    disabled={isLoading}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                >
                    <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Data
                </Button>
            </div>
            
            <Card className="shadow-sm border">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-gray-200">
                                    <TableHead className="px-6 py-4 font-semibold text-gray-900">Action</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Date & Time</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">ID</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Type</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8">
                                            <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                                            <p>Loading audits...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : audits.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                            <p>No audit logs found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedAudits.map((audit, index) => {
                                        const isRecent = audit.date_time && new Date(audit.date_time).getTime() > Date.now() - 24 * 60 * 60 * 1000
                                        const actionType = audit.performed_action?.toLowerCase().includes('delete') ? 'delete' :
                                                          audit.performed_action?.toLowerCase().includes('create') || audit.performed_action?.toLowerCase().includes('add') ? 'create' :
                                                          audit.performed_action?.toLowerCase().includes('update') || audit.performed_action?.toLowerCase().includes('edit') ? 'update' : 'read'
                                        
                                        return (
                                            <TableRow key={audit.audit_id} className={`border-b border-gray-100 hover:bg-gray-50 ${isRecent ? 'bg-blue-50' : ''}`}>
                                                <TableCell className="px-6 py-4 font-medium text-gray-900">
                                                    <div className="flex items-center gap-2">
                                                        {audit.performed_action}
                                                        {isRecent && (
                                                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                                                Recent
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-center text-gray-600">
                                                    <div>
                                                        <div className="font-medium">{audit.date_time ? new Date(audit.date_time).toLocaleDateString() : '-'}</div>
                                                        <div className="text-sm text-gray-500">{audit.date_time ? new Date(audit.date_time).toLocaleTimeString() : '-'}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-center text-gray-600">#{audit.audit_id}</TableCell>
                                                <TableCell className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                                        actionType === 'create' ? 'bg-green-100 text-green-800' :
                                                        actionType === 'update' ? 'bg-yellow-100 text-yellow-800' :
                                                        actionType === 'delete' ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {actionType.charAt(0).toUpperCase() + actionType.slice(1)}
                                                    </span>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {audits.length > 0 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        itemsPerPage={itemsPerPage}
                        totalItems={audits.length}
                      />
                    )}
                </CardContent>
            </Card>
        </div>
    )
}