import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { useAlarmSound } from "@/hooks/useAlarmSound";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Phone, MapPin, IndianRupee, Package, Clock, CheckCircle2,
  LogOut, History, Bike, Camera, X, Timer, BellRing, QrCode
} from "lucide-react";
import { format } from "date-fns";
import { UpiQrModal } from "@/components/UpiQrModal";

function LiveTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, "0")}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [since]);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-primary">
      <Timer className="w-3.5 h-3.5" />
      {elapsed}
    </span>
  );
}
import logo from "@/assets/logo.png";

interface KitchenOrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

interface KitchenOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  order_code: string | null;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  total_amount: number;
  notes: string | null;
  items: KitchenOrderItem[];
  dao_id: string; // delivery_assignment_orders id
  dao_status: string; // per-order status: pending | delivered
}

interface Assignment {
  id: string;
  batch_id: string | null;
  status: string;
  delivery_fee: number;
  total_cash_to_collect: number;
  notes: string | null;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  payment_mode: string;
  upi_screenshot_path: string | null;
  orders: KitchenOrder[];
}

export default function Dashboard() {
  const { partner, setPartner, logout } = usePartner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);
  const [paymentOrderDaoId, setPaymentOrderDaoId] = useState<string | null>(null);
  const [paymentAssignmentId, setPaymentAssignmentId] = useState<string | null>(null);
  const [upiScreenshot, setUpiScreenshot] = useState<File | null>(null);
  const [upiPreview, setUpiPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [qrOrder, setQrOrder] = useState<KitchenOrder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Push notifications
  usePushNotifications(partner?.id);

  const { data: activeAssignments, isLoading } = useQuery({
    queryKey: ["active-assignments", partner?.id],
    queryFn: async (): Promise<Assignment[]> => {
      if (!partner) return [];

      const { data: assignments } = await supabase
        .from("delivery_assignments")
        .select("*")
        .eq("delivery_partner_id", partner.id)
        .in("status", ["requested", "pending", "accepted", "picked_up"])
        .order("assigned_at", { ascending: false });

      if (!assignments || assignments.length === 0) return [];

      const assignmentIds = assignments.map((a) => a.id);

      const { data: allAssignmentOrders } = await supabase
        .from("delivery_assignment_orders")
        .select("id, assignment_id, kitchen_order_id, status, delivered_at")
        .in("assignment_id", assignmentIds);

      if (!allAssignmentOrders || allAssignmentOrders.length === 0) {
        return assignments.map((a) => ({ ...a, orders: [] })) as Assignment[];
      }

      const orderIds = [...new Set(allAssignmentOrders.map((o) => o.kitchen_order_id))];

      const [{ data: kitchenOrders }, { data: orderItems }] = await Promise.all([
        supabase
          .from("kitchen_orders")
          .select("id, customer_name, customer_phone, location_text, location_lat, location_lng, total_amount, notes, order_code")
          .in("id", orderIds),
        supabase
          .from("kitchen_order_items")
          .select("id, order_id, item_name, quantity, unit_price")
          .in("order_id", orderIds),
      ]);

      return assignments.map((assignment) => {
        const aOrders = allAssignmentOrders.filter((ao) => ao.assignment_id === assignment.id);
        const orders: KitchenOrder[] = aOrders.map((ao) => {
          const ko = kitchenOrders?.find((k) => k.id === ao.kitchen_order_id);
          const items = orderItems?.filter((i) => i.order_id === ao.kitchen_order_id) || [];
          return {
            id: ko?.id || ao.kitchen_order_id,
            customer_name: ko?.customer_name || "Unknown",
            customer_phone: ko?.customer_phone || "",
            order_code: ko?.order_code || null,
            location_text: ko?.location_text || null,
            location_lat: ko?.location_lat || null,
            location_lng: ko?.location_lng || null,
            total_amount: ko?.total_amount || 0,
            notes: ko?.notes || null,
            items,
            dao_id: ao.id,
            dao_status: (ao as any).status || "pending",
          };
        });
        return { ...assignment, orders } as Assignment;
      });
    },
    enabled: !!partner,
    refetchInterval: 5000,
  });

  // Alarm sound: play when there are requested assignments
  const hasRequestedOrders = useMemo(
    () => activeAssignments?.some((a) => a.status === "requested") ?? false,
    [activeAssignments]
  );
  useAlarmSound(hasRequestedOrders);

  const { data: todayStats } = useQuery({
    queryKey: ["today-stats", partner?.id],
    queryFn: async () => {
      if (!partner) return { count: 0, earnings: 0 };
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("delivery_assignments")
        .select("delivery_fee")
        .eq("delivery_partner_id", partner.id)
        .eq("status", "delivered")
        .gte("delivered_at", `${today}T00:00:00`)
        .lte("delivered_at", `${today}T23:59:59`);
      return {
        count: data?.length || 0,
        earnings: data?.reduce((sum, d) => sum + (d.delivery_fee || 0), 0) || 0,
      };
    },
    enabled: !!partner,
  });

  useEffect(() => {
    if (!partner) return;
    const channel = supabase
      .channel("partner-assignments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_assignments", filter: `delivery_partner_id=eq.${partner.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            toast.info("New delivery assignment!", { duration: 5000 });
          }
          queryClient.invalidateQueries({ queryKey: ["active-assignments"] });
          queryClient.invalidateQueries({ queryKey: ["today-stats"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [partner, queryClient]);

  const toggleOnline = async () => {
    if (!partner) return;
    setToggling(true);
    const newStatus = !partner.is_active;
    const { error } = await supabase
      .from("delivery_partners")
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq("id", partner.id);
    if (!error) {
      const updated = { ...partner, is_active: newStatus };
      setPartner(updated);
      localStorage.setItem("delivery_partner", JSON.stringify(updated));
      toast.success(newStatus ? "You're now online!" : "You're now offline");
    }
    setToggling(false);
  };

  const optimisticUpdate = (assignmentId: string, updater: (a: Assignment) => Assignment | null) => {
    queryClient.setQueryData<Assignment[]>(["active-assignments", partner?.id], (old) => {
      if (!old) return old;
      return old.map((a) => (a.id === assignmentId ? updater(a) : a)).filter(Boolean) as Assignment[];
    });
  };

  const acceptRequest = async (assignmentId: string, batchId: string | null) => {
    setUpdatingId(assignmentId);
    // Optimistic: update status immediately
    optimisticUpdate(assignmentId, (a) => ({ ...a, status: "accepted" }));
    // Also remove other batch assignments optimistically
    if (batchId) {
      queryClient.setQueryData<Assignment[]>(["active-assignments", partner?.id], (old) => {
        if (!old) return old;
        return old.filter((a) => a.id === assignmentId || a.batch_id !== batchId || a.status !== "requested");
      });
    }
    toast.success("Order accepted! 🎉");
    setUpdatingId(null);

    const { error } = await supabase
      .from("delivery_assignments")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", assignmentId);

    if (!error && batchId) {
      await supabase
        .from("delivery_assignments")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("batch_id", batchId)
        .neq("id", assignmentId)
        .eq("status", "requested");
    }

    if (error) {
      toast.error("Failed to accept order");
      queryClient.invalidateQueries({ queryKey: ["active-assignments"] });
    }
  };

  const rejectRequest = async (assignmentId: string) => {
    setUpdatingId(assignmentId);
    // Optimistic: remove from list
    queryClient.setQueryData<Assignment[]>(["active-assignments", partner?.id], (old) =>
      old?.filter((a) => a.id !== assignmentId)
    );
    toast.success("Order rejected");
    setUpdatingId(null);

    const { error } = await supabase
      .from("delivery_assignments")
      .update({ status: "rejected", updated_at: new Date().toISOString() })
      .eq("id", assignmentId);

    if (error) {
      toast.error("Failed to reject order");
      queryClient.invalidateQueries({ queryKey: ["active-assignments"] });
    }
  };

  const updateAssignmentStatus = async (assignmentId: string, newStatus: "accepted" | "picked_up") => {
    setUpdatingId(assignmentId);
    const now = new Date().toISOString();
    // Optimistic update
    optimisticUpdate(assignmentId, (a) => ({
      ...a,
      status: newStatus,
      ...(newStatus === "picked_up" ? { picked_up_at: now } : {}),
    }));
    const messages: Record<string, string> = {
      accepted: "Order accepted! Head to kitchen 🏃",
      picked_up: "Order picked up! On the way 🚴",
    };
    toast.success(messages[newStatus]);
    setUpdatingId(null);

    const { error } = await supabase
      .from("delivery_assignments")
      .update({
        status: newStatus,
        updated_at: now,
        ...(newStatus === "picked_up" ? { picked_up_at: now } : {}),
      })
      .eq("id", assignmentId);

    if (error) {
      toast.error("Failed to update status");
      queryClient.invalidateQueries({ queryKey: ["active-assignments"] });
    }
  };

  const compressImage = (file: File, maxWidth = 800, quality = 0.6): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressed = await compressImage(file);
        const compressedFile = new File([compressed], `compressed_${Date.now()}.jpg`, { type: "image/jpeg" });
        setUpiScreenshot(compressedFile);
        setUpiPreview(URL.createObjectURL(compressed));
      } catch {
        setUpiScreenshot(file);
        setUpiPreview(URL.createObjectURL(file));
      }
    }
  };

  const submitDelivery = async (daoId: string, assignmentId: string, paymentMode: "cash" | "upi") => {
    setSubmitting(true);

    // Optimistic: mark the order as delivered in UI immediately
    const currentAssignments = queryClient.getQueryData<Assignment[]>(["active-assignments", partner?.id]);
    const assignment = currentAssignments?.find((a) => a.id === assignmentId);
    const allWillBeDelivered = assignment?.orders.every((o) => o.dao_status === "delivered" || o.dao_id === daoId);

    queryClient.setQueryData<Assignment[]>(["active-assignments", partner?.id], (old) => {
      if (!old) return old;
      if (allWillBeDelivered) {
        // Remove entire assignment from active list
        return old.filter((a) => a.id !== assignmentId);
      }
      // Just mark this order as delivered
      return old.map((a) => {
        if (a.id !== assignmentId) return a;
        return {
          ...a,
          orders: a.orders.map((o) =>
            o.dao_id === daoId ? { ...o, dao_status: "delivered" } : o
          ),
        };
      });
    });

    toast.success(allWillBeDelivered ? "All orders delivered! 🎉" : "Order delivered! ✅");
    setPaymentOrderDaoId(null);
    setPaymentAssignmentId(null);
    setSubmitting(false);

    if (allWillBeDelivered) {
      queryClient.invalidateQueries({ queryKey: ["today-stats"] });
    }

    // Background: upload & persist
    let screenshotPath: string | null = null;

    if (paymentMode === "upi" && upiScreenshot) {
      const fileName = `${daoId}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("delivery-proofs")
        .upload(fileName, upiScreenshot, { contentType: "image/jpeg" });
      if (!uploadError) screenshotPath = fileName;
    }

    setUpiScreenshot(null);
    setUpiPreview(null);

    await supabase
      .from("delivery_assignment_orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", daoId);

    if (allWillBeDelivered) {
      await supabase
        .from("delivery_assignments")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          payment_mode: paymentMode,
          ...(screenshotPath ? { upi_screenshot_path: screenshotPath } : {}),
        })
        .eq("id", assignmentId);
    }
  };

  if (!partner) return null;

  const statusLabel: Record<string, string> = {
    requested: "New Request",
    pending: "Accepted",
    accepted: "Confirmed",
    picked_up: "Picked Up",
  };

  const statusColor: Record<string, string> = {
    requested: "bg-orange-500",
    pending: "bg-amber-500",
    accepted: "bg-blue-500",
    picked_up: "bg-primary",
  };

  const hasActiveAssignments = activeAssignments && activeAssignments.length > 0;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="w-10 h-10 rounded-full" />
            <div>
              <h2 className="font-heading font-semibold text-sm text-foreground">{partner.name}</h2>
              <p className="text-xs text-muted-foreground">{partner.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${partner.is_active ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-xs font-medium text-muted-foreground">
              {partner.is_active ? "Online" : "Offline"}
            </span>
            <Switch checked={partner.is_active} onCheckedChange={toggleOnline} disabled={toggling} />
          </div>
        </div>
      </div>

      {/* Today's Stats */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Today</p>
              <p className="text-lg font-heading font-bold text-foreground">{todayStats?.count || 0}</p>
              <p className="text-[10px] text-muted-foreground">deliveries</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <IndianRupee className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Earned</p>
              <p className="text-lg font-heading font-bold text-foreground">₹{todayStats?.earnings || 0}</p>
              <p className="text-[10px] text-muted-foreground">today</p>
            </div>
          </Card>
        </div>
      </div>

      {/* Active Assignments */}
      <div className="px-4 pt-4 space-y-4">
        {isLoading ? (
          <Card className="p-6 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </Card>
        ) : hasActiveAssignments ? (
          <>
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-foreground">
                Active Assignments ({activeAssignments.length})
              </h3>
            </div>

            {activeAssignments.map((assignment) => (
              <Card key={assignment.id} className={`overflow-hidden shadow-sm ${assignment.status === "requested" ? "ring-2 ring-orange-500 animate-pulse" : ""}`}>
                {/* Assignment header */}
                <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {assignment.status === "requested" && (
                      <BellRing className="w-4 h-4 text-orange-500 animate-bounce" />
                    )}
                    <Badge className={`${statusColor[assignment.status] || ""} text-white border-0 text-[10px]`}>
                      {statusLabel[assignment.status] || assignment.status}
                    </Badge>
                    {assignment.status === "picked_up" && assignment.picked_up_at ? (
                      <LiveTimer since={assignment.picked_up_at} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(assignment.assigned_at), "hh:mm a")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      Collect: <span className="font-bold text-foreground">₹{assignment.total_cash_to_collect}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Fee: <span className="font-bold text-success">₹{assignment.delivery_fee}</span>
                    </span>
                  </div>
                </div>

                {/* Orders within this assignment */}
                <div className="divide-y divide-border">
                  {assignment.orders.map((order, idx) => (
                    <div key={order.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {assignment.orders.length > 1 && (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <span className="text-[10px] font-bold text-primary-foreground">{idx + 1}</span>
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-sm text-foreground font-mono tracking-wider">
                              #{order.order_code ? order.order_code.slice(-4) : "----"}
                            </p>
                            <p className="text-xs text-muted-foreground">{order.customer_name}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Cash</p>
                            <p className="text-sm font-heading font-bold text-foreground">₹{order.total_amount}</p>
                          </div>
                          <button
                            onClick={() => setQrOrder(order)}
                            title="Show payment QR"
                            className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5 text-primary" />
                          </button>
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center"
                          >
                            <Phone className="w-3.5 h-3.5 text-success" />
                          </a>
                        </div>
                      </div>

                      {(order.location_lat && order.location_lng) ? (
                        <button
                          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.location_lat},${order.location_lng}`, '_blank')}
                          className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/5 px-3 py-1.5 rounded-md"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Open in Maps
                        </button>
                      ) : order.location_text ? (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
                          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          {order.location_text}
                        </div>
                      ) : null}

                      <div className="space-y-0.5">
                        {order.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                            <span>{item.quantity} × {item.item_name}</span>
                            <span>₹{item.quantity * item.unit_price}</span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <p className="text-xs text-muted-foreground italic bg-muted px-3 py-1 rounded">
                          Note: {order.notes}
                        </p>
                      )}

                      {/* Per-order deliver button (only when picked_up and not yet delivered) */}
                      {assignment.status === "picked_up" && order.dao_status !== "delivered" && (
                        <Button
                          onClick={() => {
                            setPaymentOrderDaoId(order.dao_id);
                            setPaymentAssignmentId(assignment.id);
                          }}
                          size="sm"
                          className="w-full h-9 text-xs font-semibold gap-1.5 bg-success hover:bg-success/90"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Mark Delivered
                        </Button>
                      )}
                      {assignment.status === "picked_up" && order.dao_status === "delivered" && (
                        <div className="flex items-center gap-1.5 text-xs text-success font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Delivered
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action buttons per assignment */}
                <div className="px-4 pb-4 pt-1 space-y-2">
                  {assignment.status === "requested" && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => acceptRequest(assignment.id, assignment.batch_id)}
                        disabled={updatingId === assignment.id}
                        className="flex-1 h-11 text-sm font-semibold gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        {updatingId === assignment.id ? "Accepting..." : "Accept"}
                      </Button>
                      <Button
                        onClick={() => rejectRequest(assignment.id)}
                        disabled={updatingId === assignment.id}
                        variant="destructive"
                        className="flex-1 h-11 text-sm font-semibold gap-2"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                  {(assignment.status === "pending" || assignment.status === "accepted") && (
                    <Button
                      onClick={() => updateAssignmentStatus(assignment.id, "picked_up")}
                      disabled={updatingId === assignment.id}
                      className="w-full h-11 text-sm font-semibold gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <Bike className="w-4 h-4" />
                      {updatingId === assignment.id ? "Updating..." : "Mark Picked Up"}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </>
        ) : partner.is_active ? (
          <Card className="p-8 flex flex-col items-center gap-4 shadow-sm">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <Bike className="w-8 h-8 text-success" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-success rounded-full animate-pulse" />
            </div>
            <div className="text-center">
              <p className="font-heading font-semibold text-foreground">You're Online!</p>
              <p className="text-sm text-muted-foreground">Waiting for orders...</p>
            </div>
          </Card>
        ) : (
          <Card className="p-8 flex flex-col items-center gap-4 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Bike className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-heading font-semibold text-foreground">You're Offline</p>
              <p className="text-sm text-muted-foreground">Go online to receive orders</p>
            </div>
          </Card>
        )}
      </div>

      {/* Payment Mode Modal */}
      {paymentOrderDaoId && paymentAssignmentId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-card w-full max-w-md rounded-t-2xl p-6 space-y-5 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-foreground">Payment Method</h3>
              <button onClick={() => { setPaymentOrderDaoId(null); setPaymentAssignmentId(null); setUpiScreenshot(null); setUpiPreview(null); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">How did the customer pay?</p>

            <Button
              onClick={() => submitDelivery(paymentOrderDaoId!, paymentAssignmentId!, "cash")}
              disabled={submitting}
              className="w-full h-12 text-base font-semibold gap-2"
              variant="outline"
            >
              <IndianRupee className="w-5 h-5" />
              {submitting ? "Submitting..." : "Cash Collected"}
            </Button>

            <div className="space-y-3 border border-border rounded-xl p-4">
              <p className="text-sm font-medium text-foreground">UPI Payment by Customer</p>
              <p className="text-xs text-muted-foreground">Take a photo of payment confirmation for manager review</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />

              {upiPreview ? (
                <div className="relative">
                  <img src={upiPreview} alt="UPI proof" className="w-full h-48 object-cover rounded-lg border border-border" />
                  <button
                    onClick={() => { setUpiScreenshot(null); setUpiPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-xs font-medium">Tap to take photo</span>
                </button>
              )}

              <Button
                onClick={() => submitDelivery(paymentOrderDaoId!, paymentAssignmentId!, "upi")}
                disabled={submitting || !upiScreenshot}
                className="w-full h-12 text-base font-semibold gap-2 bg-success hover:bg-success/90"
              >
                {submitting ? "Submitting..." : "Submit UPI Proof"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-2 flex items-center justify-around safe-bottom z-40">
        <button className="flex flex-col items-center gap-1 text-primary py-2 px-4">
          <Bike className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => navigate("/history")} className="flex flex-col items-center gap-1 text-muted-foreground py-2 px-4">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium">History</span>
        </button>
        <button onClick={logout} className="flex flex-col items-center gap-1 text-muted-foreground py-2 px-4">
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
