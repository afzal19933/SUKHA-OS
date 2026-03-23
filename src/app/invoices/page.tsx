"use client";

import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { 
  Printer, FileText, Search, Loader2, Building2, 
  MapPin, Phone, Mail, MoreVertical, Pencil, Trash2 
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  Table, TableBody, TableCell, TableHead, 
  TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter 
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { cn, formatAppDate } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useCollection, useMemoFirebase, useFirestore, useDoc } from "@/firebase";
import { collection, query, orderBy, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function InvoicesPage() {
  const { entityId, role } = useAuthStore();
  const db = useFirestore();
  const { toast } = useToast();

  const canEdit = role === "admin";

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
  const [invoiceToEdit, setInvoiceToEdit] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState({
    invoiceNumber: "",
    totalAmount: "",
    status: "",
  });

  const invoiceQuery = useMemoFirebase(() => {
    if (!entityId) return null;
    return query(
      collection(db, "hotel_properties", entityId, "invoices"),
      orderBy("createdAt", "desc")
    );
  }, [db, entityId]);

  const { data: invoices, isLoading } = useCollection(invoiceQuery);

  const propertyRef = useMemoFirebase(() => {
    if (!entityId) return null;
    return doc(db, "hotel_properties", entityId);
  }, [db, entityId]);
  const { data: property } = useDoc(propertyRef);

  const filteredInvoices = invoices?.filter(inv =>
    inv.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.guestDetails?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const totalRevenue = invoices?.reduce((acc, inv) => acc + (inv.totalAmount || 0), 0) || 0;

  // ✅ Generate invoice number based on type
  const generateInvoicePrefix = (inv: any) => {
    const isAyursiha = inv.isCycleInvoice || inv.invoiceNumber?.startsWith('AYUR') || inv.invoiceNumber?.startsWith('A/');
    return isAyursiha ? "A" : "2026-2027";
  };

  // ✅ Handle Edit
  const handleOpenEdit = (inv: any) => {
    setInvoiceToEdit(inv);
    setEditForm({
      invoiceNumber: inv.invoiceNumber || "",
      totalAmount: inv.totalAmount?.toString() || "",
      status: inv.status || "paid",
    });
  };

  const handleSaveEdit = async () => {
    if (!entityId || !invoiceToEdit) return;
    try {
      await updateDoc(
        doc(db, "hotel_properties", entityId, "invoices", invoiceToEdit.id),
        {
          invoiceNumber: editForm.invoiceNumber,
          totalAmount: parseFloat(editForm.totalAmount),
          status: editForm.status,
          updatedAt: new Date().toISOString(),
        }
      );
      toast({ title: "Invoice updated successfully" });
      setInvoiceToEdit(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Update failed. Please try again." });
    }
  };

  // ✅ Handle Delete
  const handleConfirmDelete = async () => {
    if (!entityId || !invoiceToDelete) return;
    try {
      await deleteDoc(
        doc(db, "hotel_properties", entityId, "invoices", invoiceToDelete.id)
      );
      toast({ title: "Invoice deleted successfully" });
      setInvoiceToDelete(null);
    } catch (error) {
      toast({ variant: "destructive", title: "Delete failed. Please try again." });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl font-bold tracking-tight">GST Invoices</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-bold tracking-widest">Billing records and folio history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Collected Revenue</p>
              <h3 className="text-sm font-bold">₹{totalRevenue.toLocaleString()}</h3>
            </div>
          </div>
          <div className="p-3 bg-white rounded-xl border shadow-sm flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/10 text-primary rounded-lg">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Total Invoices Issued</p>
              <h3 className="text-sm font-bold">{invoices?.length || 0} Invoices</h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input 
              placeholder="Search invoice or guest name..." 
              className="pl-9 h-9 text-[11px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow>
                <TableHead className="px-4 h-9 text-[9px] font-bold uppercase tracking-wider">Invoice #</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider">Guest</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider">Date</TableHead>
                <TableHead className="h-9 text-[9px] font-bold uppercase tracking-wider text-right">Grand Total</TableHead>
                <TableHead className="text-right px-4 h-9 text-[9px] font-bold uppercase tracking-wider">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-secondary/10 group">
                    <TableCell className="px-4 font-mono text-[10px] font-bold text-primary">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-[11px] font-medium">{inv.guestDetails?.name}</TableCell>
                    <TableCell className="text-[10px]">{formatAppDate(inv.createdAt)}</TableCell>
                    <TableCell className="font-bold text-[11px] text-right">₹{inv.totalAmount?.toLocaleString()}</TableCell>
                    <TableCell className="text-right px-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* View/Print Button */}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity" 
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          View/Print
                        </Button>

                        {/* ✅ 3-dot Menu — Edit & Delete */}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 rounded-xl">
                              <DropdownMenuItem 
                                className="text-[11px] font-bold cursor-pointer"
                                onClick={() => handleOpenEdit(inv)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-2 text-primary" />
                                Edit Invoice
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-[11px] font-bold cursor-pointer text-rose-600 focus:text-rose-600 focus:bg-rose-50"
                                onClick={() => setInvoiceToDelete(inv)}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete Invoice
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-[10px] uppercase font-bold text-muted-foreground">
                    No billing records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* ✅ GST Invoice View Dialog */}
        <Dialog open={!!selectedInvoice} onOpenChange={(o) => !o && setSelectedInvoice(null)}>
          <DialogContent className="max-w-[800px] p-0 overflow-hidden bg-white">
            <div className="p-10 space-y-6" id="printable-invoice">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-primary pb-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-primary uppercase tracking-tighter">Sukha Retreats</h2>
                      <p className="text-[8px] font-bold uppercase text-muted-foreground tracking-widest">Professional Property Management</p>
                    </div>
                  </div>
                  <div className="text-[10px] text-muted-foreground space-y-0.5 mt-2">
                    <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary" /> Peringazha, HMT Colony, North Kalamassery, Kochi, Kerala 683503</div>
                    <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-primary" /> +91 9895556667</div>
                    <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-primary" /> sukharetreats2023@gmail.com</div>
                    <div className="font-bold text-primary mt-1">GSTIN: 32AFAFS2812R1ZU</div>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  <Badge className="bg-primary text-white text-[12px] font-black px-4 py-1.5 uppercase rounded-lg shadow-md mb-2">TAX INVOICE</Badge>
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">Invoice Details</div>
                  <div className="font-mono text-[14px] font-black text-primary">{selectedInvoice?.invoiceNumber}</div>
                  <div className="text-[11px] font-bold">{formatAppDate(selectedInvoice?.createdAt)}</div>
                </div>
              </div>

              {/* Guest & Stay Details */}
              <div className="grid grid-cols-2 gap-10 pt-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-primary border-b border-primary/20 pb-1 mb-2">Billed To</h3>
                    <div className="space-y-1">
                      <p className="text-[13px] font-black">{selectedInvoice?.guestDetails?.name}</p>
                      <p className="text-[11px] text-muted-foreground">{selectedInvoice?.guestDetails?.address}</p>
                      <p className="text-[11px] font-bold">Contact: {selectedInvoice?.guestDetails?.contact}</p>
                      <p className="text-[11px] font-bold uppercase">State: {selectedInvoice?.guestDetails?.state}</p>
                      {selectedInvoice?.guestDetails?.gstin !== "N/A" && (
                        <p className="text-[11px] font-black text-primary">GSTIN: {selectedInvoice?.guestDetails?.gstin}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-[10px] font-black uppercase text-primary border-b border-primary/20 pb-1 mb-2">Stay Info</h3>
                    <div className="grid grid-cols-2 gap-y-2 text-[11px]">
                      <span className="font-bold text-muted-foreground">Room Number:</span>
                      <span className="font-black text-right">{selectedInvoice?.stayDetails?.roomNumber}</span>
                      <span className="font-bold text-muted-foreground">Arrival Date:</span>
                      <span className="font-black text-right">{formatAppDate(selectedInvoice?.stayDetails?.arrivalDate)}</span>
                      <span className="font-bold text-muted-foreground">Check-Out Date:</span>
                      <span className="font-black text-right">{formatAppDate(selectedInvoice?.stayDetails?.departureDate)}</span>
                      <span className="font-bold text-muted-foreground">Place of Supply:</span>
                      <span className="font-black text-right">{selectedInvoice?.stayDetails?.placeOfSupply}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="pt-4">
                <Table className="border-2 border-primary/10 rounded-xl overflow-hidden shadow-sm">
                  <TableHeader className="bg-primary/5">
                    <TableRow className="h-10 hover:bg-transparent">
                      <TableHead className="text-[11px] font-black uppercase text-primary w-12 text-center">#</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-primary">Item / Description</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-primary text-center">Qty</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-primary text-right">Unit Price</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-primary text-center">GST %</TableHead>
                      <TableHead className="text-[11px] font-black uppercase text-primary text-right pr-6">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedInvoice?.items?.map((item: any, idx: number) => (
                      <TableRow key={idx} className="h-12 hover:bg-transparent border-b border-primary/5">
                        <TableCell className="text-[11px] text-center font-bold text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-[11px] font-black">{item.name}</TableCell>
                        <TableCell className="text-[11px] text-center font-bold">{item.qty}</TableCell>
                        <TableCell className="text-[11px] text-right font-bold">₹{item.price?.toLocaleString()}</TableCell>
                        <TableCell className="text-[11px] text-center font-bold">{item.gstRate}%</TableCell>
                        <TableCell className="text-[11px] text-right font-black pr-6">₹{item.amount?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Calculation Area */}
              <div className="grid grid-cols-2 gap-10 pt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-secondary/20 rounded-xl space-y-3">
                    <p className="text-[10px] font-black uppercase text-primary border-b border-primary/10 pb-1">Payment Details</p>
                    <div className="text-[11px] space-y-1">
                      <p><span className="font-bold text-muted-foreground">Bank:</span> Federal Bank, Thaikkattukara</p>
                      <p><span className="font-bold text-muted-foreground">A/C:</span> 15120200004470</p>
                      <p><span className="font-bold text-muted-foreground">IFSC:</span> FDRL0001512</p>
                      <p><span className="font-bold text-muted-foreground">Account Holder:</span> Sukharetreats</p>
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">Amount in Words:</p>
                    <p className="text-[12px] font-black text-primary leading-tight">{selectedInvoice?.totalInWords}</p>
                  </div>
                </div>
                <div className="space-y-1 px-4">
                  <div className="flex justify-between text-[11px] py-1">
                    <span className="font-bold text-muted-foreground">Subtotal</span>
                    <span className="font-black">₹{selectedInvoice?.subtotal?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] py-1">
                    <span className="font-bold text-muted-foreground">CGST (2.5%)</span>
                    <span className="font-black">₹{selectedInvoice?.cgst?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[11px] py-1">
                    <span className="font-bold text-muted-foreground">SGST (2.5%)</span>
                    <span className="font-black">₹{selectedInvoice?.sgst?.toLocaleString()}</span>
                  </div>
                  <Separator className="bg-primary/20 my-2" />
                  <div className="flex justify-between items-center py-2">
                    <span className="text-[14px] font-black text-primary uppercase">Grand Total</span>
                    <span className="text-[20px] font-black text-primary">₹{Math.round(selectedInvoice?.totalAmount || 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-6 text-center space-y-4">
                    <div className="h-16 w-full flex items-end justify-center">
                      <div className="border-t-2 border-primary/30 w-48 pt-2">
                        <p className="text-[10px] font-black uppercase text-primary">Authorized Signatory</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-10 text-center border-t-2 border-primary/10">
                <p className="text-[12px] font-black text-primary italic">"Thanks for doing business with us!"</p>
                <p className="text-[9px] text-muted-foreground mt-2 font-bold uppercase tracking-widest">Computer Generated Document - No Signature Required</p>
              </div>
            </div>

            <div className="p-6 bg-secondary/50 border-t flex justify-end gap-3 no-print">
              <Button variant="ghost" className="font-black text-xs uppercase" onClick={() => setSelectedInvoice(null)}>Close</Button>
              <Button className="h-10 px-8 font-black text-xs uppercase shadow-xl" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Download PDF / Print
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ Edit Invoice Dialog */}
        <Dialog open={!!invoiceToEdit} onOpenChange={(o) => !o && setInvoiceToEdit(null)}>
          <DialogContent className="sm:max-w-[420px] rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-sm font-black uppercase">Edit Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Invoice Number</Label>
                <Input
                  value={editForm.invoiceNumber}
                  onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                  className="h-10 rounded-xl bg-secondary/30 border-none font-bold text-sm"
                  placeholder="e.g. 2026-2027/001 or A/001"
                />
                <p className="text-[9px] text-muted-foreground font-bold">
                  Use <span className="text-primary">2026-2027/001</span> for room rent · <span className="text-primary">A/001</span> for Ayursiha
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Total Amount (₹)</Label>
                <Input
                  type="number"
                  value={editForm.totalAmount}
                  onChange={(e) => setEditForm({ ...editForm, totalAmount: e.target.value })}
                  className="h-10 rounded-xl bg-secondary/30 border-none font-bold text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Status</Label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full h-10 rounded-xl bg-secondary/30 border-none font-bold text-sm px-3 outline-none"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="ghost" className="font-black text-xs uppercase" onClick={() => setInvoiceToEdit(null)}>
                Cancel
              </Button>
              <Button className="font-black text-xs uppercase shadow-lg" onClick={handleSaveEdit}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ✅ Delete Confirmation Dialog */}
        <AlertDialog open={!!invoiceToDelete} onOpenChange={(o) => !o && setInvoiceToDelete(null)}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600">
                <Trash2 className="w-4 h-4" />
                Delete Invoice?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-bold">
                You are about to permanently delete invoice{" "}
                <span className="font-black text-primary">{invoiceToDelete?.invoiceNumber}</span>{" "}
                for{" "}
                <span className="font-black text-primary">{invoiceToDelete?.guestDetails?.name}</span>.
                <br /><br />
                This action <span className="text-rose-600 font-black">cannot be undone</span>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-black uppercase text-[10px]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[10px]"
              >
                Yes, Delete Invoice
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
}
