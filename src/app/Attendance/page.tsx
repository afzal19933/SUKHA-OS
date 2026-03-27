"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";
import { 
  ClipboardCheck, Clock, UserCheck, UserX, AlertTriangle, 
  CheckCircle, XCircle, Calendar, TrendingUp, Users,
  ChevronDown, Download, RefreshCw, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  type: 'check_in' | 'check_out';
  date: string;
  time: string;
  month: string;
  isLate: boolean;
  method: string;
  approvalStatus: string;
  propertyName: string;
  confidence?: number;
  createdAt: string;
}

interface ApprovalRequest {
  id: string;
  staffName: string;
  type: 'check_in' | 'check_out';
  date: string;
  time: string;
  reason: string;
  photoUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface StaffSummary {
  staffName: string;
  staffRole: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalCheckIns: number;
}

// ─── Helpers ──────────────────────────────────────────────────
const getCurrentMonth = () => {
  const now = new Date();
  return `${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
};

const getCurrentDate = () => {
  const now = new Date();
  return `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${now.getFullYear()}`;
};

const formatMonth = (monthStr: string) => {
  const [m, y] = monthStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${y}`;
};

// ─── Stat Card ────────────────────────────────────────────────
const StatCard = ({ title, value, icon: Icon, color, sub }: {
  title: string; value: string | number;
  icon: any; color: string; sub?: string;
}) => (
  <Card className="rounded-2xl border-none shadow-sm hover:shadow-md transition-shadow">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</p>
          <p className="text-3xl font-black mt-1 text-slate-800">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1 font-medium">{sub}</p>}
        </div>
        <div className={cn("p-3 rounded-2xl", color)}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Main Page ────────────────────────────────────────────────
export default function AttendancePage() {
  const { entityId } = useAuthStore();

  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [staffSummaries, setStaffSummaries] = useState<StaffSummary[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");

  const today = getCurrentDate();

  // ── Real-time today's records ──
  useEffect(() => {
    const q = query(
      collection(db, 'attendance_records'),
      where('date', '==', today),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setTodayRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord)));
      setIsLoading(false);
    });

    return () => unsub();
  }, [today]);

  // ── Real-time approval requests ──
  useEffect(() => {
    const q = query(
      collection(db, 'attendance_approvals'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setApprovalRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as ApprovalRequest)));
    });

    return () => unsub();
  }, []);

  // ── Monthly records ──
  useEffect(() => {
    loadMonthlyRecords();
  }, [selectedMonth]);

  const loadMonthlyRecords = async () => {
    try {
      const q = query(
        collection(db, 'attendance_records'),
        where('month', '==', selectedMonth),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceRecord));
      setMonthlyRecords(records);
      generateStaffSummaries(records);
    } catch (err) {
      console.error('Failed to load monthly records:', err);
    }
  };

  // ── Generate staff summaries from monthly records ──
  const generateStaffSummaries = (records: AttendanceRecord[]) => {
    const staffMap = new Map<string, StaffSummary>();

    records.forEach(r => {
      if (r.type !== 'check_in') return;
      const key = r.staffName;
      if (!staffMap.has(key)) {
        staffMap.set(key, {
          staffName: r.staffName,
          staffRole: r.staffRole,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          totalCheckIns: 0,
        });
      }
      const s = staffMap.get(key)!;
      s.presentDays++;
      s.totalCheckIns++;
      if (r.isLate) s.lateDays++;
    });

    setStaffSummaries(Array.from(staffMap.values()));
  };

  // ── Approve/Reject manual request ──
  const handleApproval = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'attendance_approvals', id), {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: 'Admin',
      });

      // If approved, create attendance record
      if (status === 'approved') {
        const request = approvalRequests.find(r => r.id === id);
        if (request) {
          const now = new Date();
          await import('firebase/firestore').then(({ addDoc }) =>
            addDoc(collection(db, 'attendance_records'), {
              staffName: request.staffName,
              staffId: null,
              staffRole: 'staff',
              type: request.type,
              date: request.date,
              time: request.time,
              month: selectedMonth,
              isLate: false,
              method: 'manual_approved',
              approvalStatus: 'approved',
              propertyName: 'Sukha Retreats',
              photoUrl: request.photoUrl,
              createdAt: now.toISOString(),
              timestamp: now.toISOString(),
            })
          );
        }
      }
    } catch (err) {
      console.error('Approval error:', err);
    }
  };

  // ── Stats ──
  const checkedInToday = todayRecords.filter(r => r.type === 'check_in').length;
  const checkedOutToday = todayRecords.filter(r => r.type === 'check_out').length;
  const lateToday = todayRecords.filter(r => r.isLate).length;
  const pendingApprovals = approvalRequests.length;

  // ── Month options ──
  const monthOptions = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = `${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
    return { value: val, label: formatMonth(val) };
  });

  return (
    <div className="space-y-6">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            Attendance
          </h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">
            Today: {today} • Real-time monitoring
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl font-bold text-xs uppercase"
          onClick={loadMonthlyRecords}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Checked In Today"
          value={checkedInToday}
          icon={UserCheck}
          color="bg-primary"
          sub="staff members"
        />
        <StatCard
          title="Checked Out"
          value={checkedOutToday}
          icon={UserX}
          color="bg-emerald-500"
          sub="completed shifts"
        />
        <StatCard
          title="Late Arrivals"
          value={lateToday}
          icon={AlertTriangle}
          color="bg-amber-500"
          sub="today"
        />
        <StatCard
          title="Pending Approvals"
          value={pendingApprovals}
          icon={Clock}
          color={pendingApprovals > 0 ? "bg-rose-500" : "bg-slate-400"}
          sub="manual requests"
        />
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-2xl bg-secondary p-1 h-auto">
          <TabsTrigger value="today" className="rounded-xl text-xs font-black uppercase px-4 py-2">
            Today
          </TabsTrigger>
          <TabsTrigger value="approvals" className="rounded-xl text-xs font-black uppercase px-4 py-2">
            Approvals
            {pendingApprovals > 0 && (
              <span className="ml-2 bg-rose-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                {pendingApprovals}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="rounded-xl text-xs font-black uppercase px-4 py-2">
            Monthly Report
          </TabsTrigger>
        </TabsList>

        {/* ── TODAY TAB ── */}
        <TabsContent value="today" className="mt-4">
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Today's Attendance — {today}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : todayRecords.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-bold text-muted-foreground">No attendance records today</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayRecords.map(record => (
                    <div
                      key={record.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border",
                        record.isLate ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm",
                          record.type === 'check_in' ? "bg-primary" : "bg-emerald-500"
                        )}>
                          {record.staffName?.charAt(0)?.toUpperCase() || '?'}
                        </div>

                        <div>
                          <p className="font-black text-sm text-slate-800">{record.staffName}</p>
                          <p className="text-xs text-muted-foreground font-medium capitalize">{record.staffRole}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {record.isLate && (
                          <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-black uppercase rounded-xl">
                            Late
                          </Badge>
                        )}
                        <Badge className={cn(
                          "border-none text-[10px] font-black uppercase rounded-xl",
                          record.type === 'check_in'
                            ? "bg-primary/10 text-primary"
                            : "bg-emerald-100 text-emerald-700"
                        )}>
                          {record.type === 'check_in' ? '☀️ In' : '🌙 Out'}
                        </Badge>
                        <span className="text-xs font-black text-slate-600 bg-white px-3 py-1 rounded-xl border">
                          {record.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── APPROVALS TAB ── */}
        <TabsContent value="approvals" className="mt-4">
          <Card className="rounded-2xl border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Manual Approval Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvalRequests.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                  <p className="text-sm font-bold text-muted-foreground">
                    No pending approvals
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {approvalRequests.map(req => (
                    <div
                      key={req.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-amber-50 border border-amber-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center font-black text-white text-sm">
                          {req.staffName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-800">{req.staffName}</p>
                          <p className="text-xs text-muted-foreground font-medium">
                            {req.date} • {req.time} • {req.type === 'check_in' ? 'Check In' : 'Check Out'}
                          </p>
                          {req.reason && (
                            <p className="text-xs text-amber-700 font-medium mt-0.5">
                              Reason: {req.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase h-8 px-4"
                          onClick={() => handleApproval(req.id, 'approved')}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black text-xs uppercase h-8 px-4"
                          onClick={() => handleApproval(req.id, 'rejected')}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MONTHLY TAB ── */}
        <TabsContent value="monthly" className="mt-4 space-y-4">

          {/* Month selector */}
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48 rounded-xl font-bold text-xs uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value} className="font-bold text-xs uppercase">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground font-medium">
              {monthlyRecords.length} records found
            </span>
          </div>

          {/* Staff Summary Cards */}
          {staffSummaries.length === 0 ? (
            <Card className="rounded-2xl border-none shadow-sm">
              <CardContent className="py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-bold text-muted-foreground">
                  No attendance records for {formatMonth(selectedMonth)}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {staffSummaries.map((s, i) => (
                <Card key={i} className="rounded-2xl border-none shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center font-black text-primary text-lg">
                          {s.staffName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-black text-sm text-slate-800">{s.staffName}</p>
                          <p className="text-xs text-muted-foreground font-medium capitalize">{s.staffRole}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-center">
                        <div>
                          <p className="text-xl font-black text-emerald-600">{s.presentDays}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">Present</p>
                        </div>
                        <div>
                          <p className="text-xl font-black text-amber-500">{s.lateDays}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">Late</p>
                        </div>
                        <div>
                          <p className="text-xl font-black text-slate-400">{s.absentDays}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase">Absent</p>
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground mb-1">
                        <span>Attendance Rate</span>
                        <span>{s.presentDays} / {s.presentDays + s.absentDays} days</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: s.presentDays + s.absentDays > 0
                              ? `${(s.presentDays / (s.presentDays + s.absentDays)) * 100}%`
                              : '0%'
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Monthly Records Table */}
          {monthlyRecords.length > 0 && (
            <Card className="rounded-2xl border-none shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-700">
                  All Records — {formatMonth(selectedMonth)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {monthlyRecords.map(record => (
                    <div
                      key={record.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl border text-sm",
                        record.isLate ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-xs",
                          record.type === 'check_in' ? "bg-primary" : "bg-emerald-500"
                        )}>
                          {record.staffName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-xs text-slate-800">{record.staffName}</p>
                          <p className="text-[10px] text-muted-foreground">{record.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.isLate && (
                          <Badge className="bg-amber-100 text-amber-700 border-none text-[10px] font-black rounded-lg">Late</Badge>
                        )}
                        <Badge className={cn(
                          "border-none text-[10px] font-black rounded-lg",
                          record.type === 'check_in' ? "bg-primary/10 text-primary" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {record.type === 'check_in' ? 'In' : 'Out'}
                        </Badge>
                        <span className="text-xs font-black text-slate-500">{record.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
