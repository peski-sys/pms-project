"use client"

import { getSubClasses, createSubClass, getFunds } from "@/app/api/subClassApiCalls/actions"
import { Card, CardContent } from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"

import { RefreshCw, Building2, Tag } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { Badge } from "./ui/badge"
import { getCurrentSessionUser } from "@/app/api/dashboardAPICalls/actions"

type SubClass = {
    sub_id: number
    fund_id: number
    sub_name: string
    added_at: Date | null
    funds: {
        fund_name: string
    }
    _count: {
        fiscal_year_balance: number
        symbol_holdings: number
    }
}

type Fund = {
    fund_id: number
    fund_name: string
}

export default function SubClassComponent() {
    const [subClasses, setSubClasses] = useState<SubClass[]>([])
    const [funds, setFunds] = useState<Fund[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedFund, setSelectedFund] = useState<string>('')
    const [subClassName, setSubClassName] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [isAdmin, setIsAdmin] = useState<boolean | null>()

    const fetchData = async () => {
        setIsLoading(true)
        try {
            const userPermission = await getCurrentSessionUser()
            setIsAdmin(userPermission)
            const [subClassesData, fundsData] = await Promise.all([
                getSubClasses(),
                getFunds()
            ])
            setSubClasses(subClassesData)
            setFunds(fundsData)
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load data. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (!selectedFund || !subClassName.trim()) {
            toast.error('Please select a fund and enter a sub class name')
            return
        }

        try {
            const result = await createSubClass(parseInt(selectedFund), subClassName)
            
            if (result.success) {
                toast.success(result.message)
                setSelectedFund('')
                setSubClassName('')
                setDialogOpen(false)
                await fetchData()
            } else {
                toast.error(result.message)
            }
        } catch (error) {
            console.error('Error creating sub class:', error)
            toast.error('Failed to create sub class. Please try again.')
        }
    }


    const totalUsage = subClasses.reduce((sum, sc) => sum + sc._count.fiscal_year_balance + sc._count.symbol_holdings, 0)
    const activeSubClasses = subClasses.filter(sc => sc._count.fiscal_year_balance > 0 || sc._count.symbol_holdings > 0).length

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Tag className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Sub Classes</p>
                            <p className="text-2xl font-bold text-gray-900">{subClasses.length}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                <Building2 className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Active Sub Classes</p>
                            <p className="text-2xl font-bold text-gray-900">{activeSubClasses}</p>
                        </div>
                    </div>
                </div>
                
                <div className="bg-white rounded-lg shadow-sm p-6 border">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-gray-600">Total Usage</p>
                            <p className="text-2xl font-bold text-gray-900">{totalUsage}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-6">
                {isAdmin && 
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>+ Add Sub Class</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add Sub Class</DialogTitle>
                            <DialogDescription>
                                Create a new sub class to categorize holdings within a fund. Sub classes help differentiate between different types of holdings.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="grid gap-4">
                            <div className="grid gap-3">
                                <Label htmlFor="fund-select">Select Fund</Label>
                                <Select value={selectedFund} onValueChange={setSelectedFund}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a fund" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {funds.map((fund) => (
                                            <SelectItem key={fund.fund_id} value={fund.fund_id.toString()}>
                                                {fund.fund_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-3">
                                <Label htmlFor="sub-class-name">Sub Class Name</Label>
                                <Input 
                                    id="sub-class-name"
                                    value={subClassName}
                                    onChange={(e) => setSubClassName(e.target.value)}
                                    placeholder="Enter sub class name"
                                    required 
                                />
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">Cancel</Button>
                                </DialogClose>
                                <Button type="submit">Create Sub Class</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
                }
            </div>

            <Card className="shadow-sm border">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-b border-gray-200">
                                    <TableHead className="px-6 py-4 font-semibold text-gray-900">Sub Class ID</TableHead>
                                    <TableHead className="px-6 py-4 font-semibold text-gray-900">Sub Class Name</TableHead>
                                    <TableHead className="px-6 py-4 font-semibold text-gray-900">Fund</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Holdings Usage</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Balance Usage</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Status</TableHead>
                                    <TableHead className="px-6 py-4 text-center font-semibold text-gray-900">Created Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            <RefreshCw className="animate-spin size-6 mx-auto mb-2" />
                                            <p>Loading data...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : subClasses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8">
                                            <div className="text-gray-500">
                                                <Tag className="size-8 mx-auto mb-2 opacity-50" />
                                                <p>No sub classes found</p>
                                                <p className="text-sm">Create your first sub class to get started</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    subClasses.map((subClass) => {
                                        const isInUse = subClass._count.fiscal_year_balance > 0 || subClass._count.symbol_holdings > 0
                                        return (
                                            <TableRow key={subClass.sub_id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <TableCell className="px-6 py-4 font-medium text-gray-900">#{subClass.sub_id}</TableCell>
                                                <TableCell className="px-6 py-4 font-medium text-gray-900">
                                                    {subClass.sub_name}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-gray-600">
                                                    {subClass.funds.fund_name}
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-center">
                                                    <Badge variant={subClass._count.symbol_holdings > 0 ? "default" : "secondary"}>
                                                        {subClass._count.symbol_holdings}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-center">
                                                    <Badge variant={subClass._count.fiscal_year_balance > 0 ? "default" : "secondary"}>
                                                        {subClass._count.fiscal_year_balance}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-center">
                                                    <Badge variant={isInUse ? "default" : "outline"}>
                                                        {isInUse ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-center text-gray-600">
                                                    {subClass.added_at
                                                        ? new Date(subClass.added_at).toLocaleDateString()
                                                        : 'N/A'
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
