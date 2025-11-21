"use server"
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";


export async function ConfirmDelete(uploaded_id: number, file_name: string) {
    try {
        // Validate inputs
        if (!uploaded_id || uploaded_id <= 0) {
            throw new Error("Invalid upload ID provided");
        }

        if (!file_name || file_name.trim() === "") {
            throw new Error("File name not provided");
        }

        // Check if the upload exists before attempting safe deletion
        const existingUpload = await prisma.uploads.findUnique({
            where: { upload_id: uploaded_id },
            select: { upload_id: true, file_name: true, is_confirmed: true },
        });

        if (!existingUpload) {
            throw new Error(`Upload with ID ${uploaded_id} not found`);
        }

        // Use database-level safe deletion to ensure holdings and sell records remain consistent
        const rawResult = await prisma.$queryRaw<
            Array<{ result: any }>
        >`
            SELECT safe_delete_upload(${uploaded_id}::INT) as result
        `;

        const deleteResult = rawResult[0]?.result;

        if (!deleteResult || deleteResult.success === false) {
            const errMsg = deleteResult?.error || deleteResult?.message || "Safe deletion failed";
            return {
                success: false,
                error: errMsg,
            };
        }

        // Create audit log (safe_delete_upload already logs at DB level, this is an application-level log)
        await prisma.audit_log.create({
            data: {
                performed_action: `Deleted File via safe_delete_upload: ${file_name} (ID: ${uploaded_id}, Confirmed: ${existingUpload.is_confirmed})`,
            },
        });

        // Revalidate the page
        revalidatePath("/dashboard/order-books");

        return {
            success: true,
            message: deleteResult.message || "Upload deleted successfully",
            deletedId: uploaded_id,
            fileName: file_name,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to delete upload",
        };
    }
}
