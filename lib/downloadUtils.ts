// Client-side download utility functions

export function triggerFileDownload(downloadData: string, fileName: string) {
  if (typeof window === 'undefined') {
    console.error('triggerFileDownload can only be called on the client side');
    return;
  }

  try {
    // Create a temporary link element
    const link = document.createElement('a');
    link.href = downloadData;
    link.download = fileName;
    link.style.display = 'none';
    
    // Add to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Download triggered for file: ${fileName}`);
  } catch (error) {
    console.error('Error triggering download:', error);
    
    // Fallback: Open in new window
    try {
      const newWindow = window.open(downloadData, '_blank');
      if (!newWindow) {
        alert('Download failed. Please check your popup blocker settings.');
      }
    } catch (fallbackError) {
      console.error('Fallback download method also failed:', fallbackError);
      alert('Download failed. Please try again.');
    }
  }
}

export function downloadBase64File(base64Data: string, fileName: string, mimeType: string = 'application/octet-stream') {
  const downloadData = `data:${mimeType};base64,${base64Data}`;
  triggerFileDownload(downloadData, fileName);
}