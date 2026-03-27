"use client";

import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  setDoc,
  orderBy
} from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { 
  ClipboardCheck, Clock, UserCheck, UserX, AlertTriangle, 
  CheckCircle, XCircle, Calendar, TrendingUp, Users,
  Download, RefreshCw, Eye, Pencil, Trash2, IndianRupee,
  Share2, ChevronRight, Filter, CalendarDays
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import { format, parse, differenceInMinutes, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval, isSunday } from "date-fns";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  type: 'check_in' | 'check_out';
  date: string; // DD-MM-YYYY
  time: string; // HH:mm
  month: string; // MM-YYYY
  isLate: boolean;
  createdAt: string;
}

interface StaffProfile {
  id: string;
  name: string;
  role: string;
  monthlySalary?: number;
  phoneNumber?: string;
}

// ─── Helpers ──────────────────────────────────────────────────
const getCurrentMonth = () => format(new Date(), "MM-yyyy");
const getCurrentDate = () => format(new Date(), "dd-MM-yyyy");

const SHIFT_START = "09:00";

const calculateHours = (checkIn?: string, checkOut?: string) => {
  if (!checkIn || !checkOut) return "0.0";
  try {
    const start = parse(checkIn, "HH:mm", new Date());
    const end = parse(checkOut, "HH:mm", new Date());
    const diff = differenceInMinutes(end, start);
    return (diff / 60).toFixed(1);
  } catch {
    return "0.0";
  }
};

const getStatus = (checkInTime: string, isLate: boolean) => {
  if (!checkInTime) return { label: "Absent", color: "bg-rose-500", variant: "destructive" };
  const start = parse(SHIFT_START, "HH:mm", new Date());
  const actual = parse(checkInTime, "HH:mm", new Date());
  const delay = differenceInMinutes(actual, start);
  
  if (delay > 60) return { label: "Half Day", color: "bg-orange-500", variant: "warning" };
  if (isLate || delay > 0) return { label: "Late", color: "bg-amber-500", variant: "warning" };
  return { label: "Present", color: "bg-emerald-500", variant: "success" };
};

const getWorkingDaysInMonth = (monthStr: string) => {
  const [month, year] = monthStr.split('-').map(Number);
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => !isSunday(d)).length;
};

// ─── Main Page ────────────────────────────────────────────────
export default function AttendancePage() {
  const { entityId, role: currentUserRole } = useAuthStore();
  const { toast } = useToast();
  const isAdmin = currentUserRole === 'admin';

  // State
  const [activeTab, setActiveTab] = useState("today");
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [quickFilter, setQuickFilter] = useState("this_month");

  // Dialogs
  const [editRecord, setEditRecord] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState<any>(null);
  const [salaryEdit, setSalaryEdit] = useState<any>(null);

  const today = getCurrentDate();

  // 1. Real-time Today's Records
  useEffect(() => {
    const q = query(collection(db, 'attendance_records'), where('date', '==', today));
    return onSnapshot(q, (snap) => {
      setTodayRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      setIsLoading(false);
    });
  }, [today]);

  // 2. Load Staff Profiles for Payroll
  useEffect(() => {
    if (!entityId) return;
    const q = query(collection(db, 'user_profiles'), where('entityId', '==', entityId));
    return onSnapshot(q, (snap) => {
      setStaffProfiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as StaffProfile)));
    });
  }, [entityId]);

  // 3. Load All Records for Filtering
  useEffect(() => {
    const q = query(collection(db, 'attendance_records'));
    return onSnapshot(q, (snap) => {
      setAllRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
    });
  }, []);

  // Compute Today's Attendance Pairs
  const pairedToday = useMemo(() => {
    const map: Record<string, any> = {};
    todayRecords.forEach(r => {
      if (!map[r.staffName]) map[r.staffName] = { name: r.staffName, role: r.staffRole, checkIn: null, checkOut: null };
      if (r.type === 'check_in') map[r.staffName].checkIn = r;
      if (r.type === 'check_out') map[r.staffName].checkOut = r;
    });
    return Object.values(map);
  }, [todayRecords]);

  // Filter Records Logic
  const filteredRecords = useMemo(() => {
    let base = [...allRecords];
    
    if (quickFilter === 'this_month') {
      const current = format(new Date(), "MM-yyyy");
      base = base.filter(r => r.month === current);
    } else if (quickFilter === 'last_month') {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      const last = format(d, "MM-yyyy");
      base = base.filter(r => r.month === last);
    } else if (selectedMonth !== "all") {
      base = base.filter(r => r.month === selectedMonth);
    }

    if (dateRange.from && dateRange.to) {
      const start = parse(dateRange.from, "yyyy-MM-dd", new Date());
      const end = parse(dateRange.to, "yyyy-MM-dd", new Date());
      base = base.filter(r => {
        const d = parse(r.date, "dd-MM-yyyy", new Date());
        return isWithinInterval(d, { start, end });
      });
    }

    // Group for table view
    const grouped: Record<string, any> = {};
    base.forEach(r => {
      const key = `${r.staffName}_${r.date}`;
      if (!grouped[key]) grouped[key] = { id: r.id, name: r.staffName, date: r.date, checkIn: null, checkOut: null, role: r.staffRole, month: r.month, isLate: false };
      if (r.type === 'check_in') {
        grouped[key].checkIn = r.time;
        grouped[key].isLate = r.isLate;
      }
      if (r.type === 'check_out') grouped[key].checkOut = r.time;
    });

    return Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
  }, [allRecords, selectedMonth, dateRange, quickFilter]);

  const distinctMonths = useMemo(() => {
    const set = new Set(allRecords.map(r => r.month));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allRecords]);

  // Payroll Calculation
  const payrollData = useMemo(() => {
    const monthStr = quickFilter === 'last_month' ? format(new Date(new Date().setMonth(new Date().getMonth() - 1)), "MM-yyyy") : getCurrentMonth();
    const workingDays = getWorkingDaysInMonth(monthStr);
    
    return staffProfiles.map(staff => {
      const records = allRecords.filter(r => r.staffName === staff.name && r.month === monthStr);
      const grouped: Record<string, any> = {};
      records.forEach(r => {
        if (!grouped[r.date]) grouped[r.date] = { checkIn: null };
        if (r.type === 'check_in') grouped[r.date].checkIn = r.time;
      });

      let presentDays = 0;
      let halfDays = 0;
      
      Object.values(grouped).forEach((day: any) => {
        const status = getStatus(day.checkIn, false);
        if (status.label === "Present" || status.label === "Late") presentDays++;
        if (status.label === "Half Day") halfDays++;
      });

      const absentDays = workingDays - (presentDays + halfDays);
      const monthlySalary = staff.monthlySalary || 0;
      const perDay = monthlySalary / workingDays;
      const deductions = (absentDays * perDay) + (halfDays * perDay * 0.5);
      const netSalary = Math.max(0, monthlySalary - deductions);

      return {
        ...staff,
        presentDays,
        halfDays,
        absentDays,
        deductions: Math.round(deductions),
        netSalary: Math.round(netSalary),
        monthStr
      };
    });
  }, [staffProfiles, allRecords, quickFilter]);

  const handleUpdateSalary = async () => {
    if (!salaryEdit) return;
    await updateDoc(doc(db, 'user_profiles', salaryEdit.id), {
      monthlySalary: parseFloat(salaryEdit.amount)
    });
    toast({ title: "Salary Updated" });
    setSalaryEdit(null);
  };

  const handleShareWhatsApp = (staff: any) => {
    const phone = staff.phoneNumber || "9895556667";
    const msg = `*SUKHA OS - Salary Advice*\nMonth: ${staff.monthStr}\nStaff: ${staff.name}\n\nPresent: ${staff.presentDays}\nHalf Days: ${staff.halfDays}\nAbsent: ${staff.absentDays}\nDeductions: ₹${staff.deductions}\n*Net Salary: ₹${staff.netSalary}*`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleDeleteRecord = async () => {
    if (!isDeleting) return;
    // Note: This only deletes the specific grouped record representative ID
    await deleteDoc(doc(db, 'attendance_records', isDeleting.id));
    toast({ title: "Record Deleted" });
    setIsDeleting(null);
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto pb-20">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-primary" />
              Attendance & Payroll
            </h1>
            <p className="text-[11px] text-muted-foreground font-black uppercase tracking-widest mt-1">Real-time Human Resource Audit</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl h-9 text-[10px] font-black uppercase" onClick={() => window.location.reload()}>
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Live Sync
            </Button>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-2xl h-14 shadow-sm w-full md:w-auto">
            <TabsTrigger value="today" className="rounded-xl h-11 px-8 text-[11px] font-black uppercase">Today's Roll</TabsTrigger>
            <TabsTrigger value="records" className="rounded-xl h-11 px-8 text-[11px] font-black uppercase">Attendance Ledger</TabsTrigger>
            <TabsTrigger value="payroll" className="rounded-xl h-11 px-8 text-[11px] font-black uppercase text-primary">Financial Payroll</TabsTrigger>
          </TabsList>

          {/* TODAY TAB */}
          <TabsContent value="today" className="space-y-4">
            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-primary">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-14 pl-10 text-[10px] font-black uppercase text-white">Staff Name</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white">Role</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Check In</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Check Out</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Hours</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center pr-10">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-20"><RefreshCw className="animate-spin w-6 h-6 mx-auto text-primary" /></TableCell></TableRow>
                  ) : pairedToday.length > 0 ? pairedToday.map((p, idx) => {
                    const status = getStatus(p.checkIn?.time, p.checkIn?.isLate);
                    return (
                      <TableRow key={idx} className="border-b border-secondary/50 hover:bg-primary/5 transition-colors">
                        <TableCell className="pl-10 py-5 font-black text-sm text-slate-800 uppercase tracking-tight">{p.name}</TableCell>
                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.role}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold">{p.checkIn?.time || "--:--"}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold">{p.checkOut?.time || "--:--"}</TableCell>
                        <TableCell className="text-center font-black text-primary text-sm">{calculateHours(p.checkIn?.time, p.checkOut?.time)}h</TableCell>
                        <TableCell className="text-center pr-10">
                          <Badge className={cn("text-[9px] font-black uppercase px-3 h-6 rounded-full", status.color)}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={6} className="text-center py-24 text-[10px] font-black uppercase text-muted-foreground">No records found for today</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* RECORDS TAB */}
          <TabsContent value="records" className="space-y-6">
            <div className="flex flex-wrap gap-4 items-end bg-secondary/20 p-6 rounded-[2rem] border border-dashed border-primary/20">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Quick Filters</Label>
                <div className="flex gap-2">
                  <Button variant={quickFilter === 'this_month' ? 'default' : 'outline'} size="sm" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase" onClick={() => { setQuickFilter('this_month'); setSelectedMonth("all"); }}>This Month</Button>
                  <Button variant={quickFilter === 'last_month' ? 'default' : 'outline'} size="sm" className="h-9 px-4 rounded-xl text-[10px] font-black uppercase" onClick={() => { setQuickFilter('last_month'); setSelectedMonth("all"); }}>Last Month</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Month Dropdown</Label>
                <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setQuickFilter("none"); }}>
                  <SelectTrigger className="h-9 w-40 rounded-xl text-[10px] font-black uppercase"><SelectValue placeholder="Select Month" /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="text-[10px] font-bold">All Months</SelectItem>
                    {distinctMonths.map(m => <SelectItem key={m} value={m} className="text-[10px] font-bold uppercase">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 flex-1 min-w-[200px]">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Custom Range</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} className="h-9 rounded-xl text-xs" />
                  <span className="text-[10px] font-black text-muted-foreground">TO</span>
                  <Input type="date" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} className="h-9 rounded-xl text-xs" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] border shadow-sm overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-800">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="h-14 pl-10 text-[10px] font-black uppercase text-white">Staff</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Date</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">In</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Out</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Hours</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-white text-center">Status</TableHead>
                    <TableHead className="text-right text-[10px] font-black uppercase text-white pr-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((r, i) => {
                    const status = getStatus(r.checkIn, r.isLate);
                    return (
                      <TableRow key={i} className="border-b border-secondary/50 group">
                        <TableCell className="pl-10 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-[13px] uppercase text-slate-800">{r.name}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{r.role}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-[11px] font-bold text-slate-600">{r.date}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold">{r.checkIn || "--:--"}</TableCell>
                        <TableCell className="text-center font-mono text-xs font-bold">{r.checkOut || "--:--"}</TableCell>
                        <TableCell className="text-center font-black text-slate-700">{calculateHours(r.checkIn, r.checkOut)}h</TableCell>
                        <TableCell className="text-center">
                          <Badge className={cn("text-[8px] font-black uppercase h-5 px-2", status.color)}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right pr-10">
                          {isAdmin && (
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setEditRecord(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => setIsDeleting(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* PAYROLL TAB */}
          <TabsContent value="payroll" className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Salary Config */}
              <Card className="lg:col-span-1 border-none shadow-sm rounded-[2rem] bg-slate-50">
                <CardHeader>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <IndianRupee className="w-4 h-4" /> Salary Registry
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {staffProfiles.map(s => (
                      <div key={s.id} className="p-4 bg-white rounded-2xl border shadow-sm flex items-center justify-between group hover:border-primary transition-all">
                        <div>
                          <p className="text-[11px] font-black uppercase text-slate-800">{s.name}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Base: ₹{(s.monthlySalary || 0).toLocaleString()}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-xl" onClick={() => setSalaryEdit({...s, amount: s.monthlySalary || ""})}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payroll Results */}
              <Card className="lg:col-span-2 border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
                <CardHeader className="bg-primary p-8 text-white flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Monthly Payroll Audit</CardTitle>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">
                      Cycle: {quickFilter === 'last_month' ? 'Last Month' : 'Current Month'} • {getWorkingDaysInMonth(quickFilter === 'last_month' ? format(new Date(new Date().setMonth(new Date().getMonth() - 1)), "MM-yyyy") : getCurrentMonth())} working days
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" className="h-9 text-[10px] font-black uppercase text-white hover:bg-white/10" onClick={() => setQuickFilter(quickFilter === 'last_month' ? 'this_month' : 'last_month')}>
                      <RefreshCw className="w-3.5 h-3.5 mr-2" /> Switch Cycle
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-primary/5">
                      <TableRow className="border-none">
                        <TableHead className="pl-8 text-[9px] font-black uppercase">Staff Member</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-center">P / H / A</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-center">Deductions</TableHead>
                        <TableHead className="text-[9px] font-black uppercase text-right">Net Salary</TableHead>
                        <TableHead className="text-right pr-8 text-[9px] font-black uppercase">WhatsApp</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.map((staff, i) => (
                        <TableRow key={i} className="border-b border-secondary/50">
                          <TableCell className="pl-8 py-5">
                            <div className="flex flex-col">
                              <span className="font-black text-sm uppercase text-slate-800">{staff.name}</span>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase">{staff.role}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1.5 font-bold text-[11px]">
                              <span className="text-emerald-600">{staff.presentDays}</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-orange-500">{staff.halfDays}</span>
                              <span className="text-slate-300">/</span>
                              <span className="text-rose-500">{staff.absentDays}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-bold text-[11px] text-rose-600">- ₹{staff.deductions.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-black text-primary text-sm">₹{staff.netSalary.toLocaleString()}</TableCell>
                          <TableCell className="text-right pr-8">
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-emerald-600 hover:bg-emerald-50 rounded-2xl shadow-sm" onClick={() => handleShareWhatsApp(staff)}>
                              <Share2 className="w-4.5 h-4.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* DIALOGS */}
        <Dialog open={!!salaryEdit} onOpenChange={o => !o && setSalaryEdit(null)}>
          <DialogContent className="sm:max-w-[360px] rounded-[2rem]">
            <DialogHeader><DialogTitle className="text-sm font-black uppercase">Set Monthly Salary</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase">Amount (₹)</Label>
                <Input type="number" value={salaryEdit?.amount} onChange={e => setSalaryEdit({...salaryEdit, amount: e.target.value})} className="h-12 rounded-xl bg-secondary/50 border-none font-bold text-lg" />
              </div>
              <Button className="w-full h-12 font-black uppercase text-[11px]" onClick={handleUpdateSalary}>Save Configuration</Button>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!isDeleting} onOpenChange={o => !o && setIsDeleting(null)}>
          <AlertDialogContent className="rounded-[2rem]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-rose-600"><Trash2 className="w-5 h-5" /> Purge Attendance Record?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs font-bold uppercase tracking-tight">Are you absolutely sure? This will remove the record for {isDeleting?.name} on {isDeleting?.date}.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-black text-[10px] uppercase">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteRecord} className="bg-rose-600 hover:bg-rose-700 rounded-xl font-black text-[10px] uppercase text-white">Yes, Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </AppLayout>
  );
}

function Edit2({ className }: { className?: string }) {
  return <Pencil className={className} />;
}
