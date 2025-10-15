"use server"
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { toast } from "sonner";


export async function ConfirmDelete(uploaded_id: number, file_name: string) {
    try {
        // Validate inputs
        if (!uploaded_id || uploaded_id <= 0) {
            throw new Error('Invalid upload ID provided');
        }

        if (!file_name || file_name.trim() === '') {
            throw new Error('File name not provided');
        }

        // Check if the upload exists before deletion
        const existingUpload = await prisma.uploads.findUnique({
            where: { upload_id: uploaded_id },
            select: { upload_id: true, file_name: true, is_confirmed: true }
        });

        if (!existingUpload) {
            throw new Error(`Upload with ID ${uploaded_id} not found`);
        }

        // Delete the upload (this will cascade delete related records)
        await prisma.uploads.delete({
            where: { upload_id: uploaded_id }
        });

        // Create audit log
        await prisma.audit_log.create({
            data: {
                performed_action: `Deleted File: ${file_name} (ID: ${uploaded_id}, Confirmed: ${existingUpload.is_confirmed})`
            }
        });

        // Revalidate the page
        revalidatePath('/dashboard/order-books');

        toast.success(`Successfully deleted upload: ${file_name}`);
        return {
            success: true,
            message: 'Upload deleted successfully',
            deletedId: uploaded_id,
            fileName: file_name
        };

    } catch (error) {
        console.log(`Error deleting upload ${uploaded_id}`);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete upload'
        };
    }
}
