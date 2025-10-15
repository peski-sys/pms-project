"use server"

const microservice_url = process.env.MICROSERVICE_URL;

export type ExportData = {
  fileName: string;
  data: any[];
  pageType: 'transaction-history' | 'view-ledger' | 'metric-dashboard';
  filters?: {
    clientName?: string;
    clientId?: string;
    transactionType?: string;
    symbol?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    fiscalYear?: string;
    [key: string]: any;
  };
};

export async function universalExport(exportData: ExportData) {
  try {
    console.log('Starting export for page:', exportData.pageType);
    console.log('Data count:', exportData.data.length);
    
    if (!exportData.data || exportData.data.length === 0) {
      throw new Error('No data available to export');
    }
    
    // Prepare export payload
    const payload = {
      fileName: exportData.fileName,
      pageType: exportData.pageType,
      data: exportData.data,
      filters: exportData.filters || {},
      exportTimestamp: new Date().toISOString(),
      totalRecords: exportData.data.length
    };
    
    // Send to microservice
    console.log('Sending data to microservice...');
    const response = await fetch(`${microservice_url}/exportFile/`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    // Get the blob data
    const blob = await response.blob();
    
    if (blob.size === 0) {
      throw new Error('Received empty file from server');
    }
    
    console.log('Received blob size:', blob.size);
    
    // Convert blob to base64 for client-side download
    const buffer = await blob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Create download data URL
    const downloadData = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    
    // Always return the data for client-side handling since this is a server action
    return {
      success: true,
      fileName: `${exportData.fileName}.xlsx`,
      downloadData,
      message: `Successfully exported ${exportData.data.length} records`
    };
    
  } catch (error) {
    console.error('Export error:', error);
    return {
      success: false,
      message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Helper function to trigger client-side download
export async function triggerDownload(fileName: string, base64Data: string) {
  if (typeof window === 'undefined') return;
  
  try {
    const link = document.createElement('a');
    link.href = base64Data;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Download trigger error:', error);
  }
}