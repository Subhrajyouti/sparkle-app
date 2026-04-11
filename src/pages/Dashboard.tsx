import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Phone, MapPin, IndianRupee, Package, Clock, CheckCircle2,
  LogOut, History, Bike, Camera, X
} from "lucide-react";
import { format } from "date-fns";
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
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  total_amount: number;
  notes: string | null;
  items: KitchenOrderItem[];
}

interface Assignment {
  id: string;
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
  const [paymentAssignmentId, setPaymentAssignmentId] = useState<string | null>(null);
  const [upiScreenshot, setUpiScreenshot] = useState<File | null>(null);
  const [upiPreview, setUpiPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: activeAssignments, isLoading } = useQuery({
    queryKey: ["active-assignments", partner?.id],
    queryFn: async (): Promise<Assignment[]> => {
      if (!partner) return [];

      const { data: assignments } = await supabase
        .from("delivery_assignments")
        .select("*")
        .eq("delivery_partner_id", partner.id)
        .in("status", ["pending", "accepted", "picked_up"])
        .order("assigned_at", { ascending: false });

      if (!assignments || assignments.length === 0) return [];

      const assignmentIds = assignments.map((a) => a.id);

      const { data: allAssignmentOrders } = await supabase
        .from("delivery_assignment_orders")
        .select("id, assignment_id, kitchen_order_id")
        .in("assignment_id", assignmentIds);

      if (!allAssignmentOrders || allAssignmentOrders.length === 0) {
        return assignments.map((a) => ({ ...a, orders: [] })) as Assignment[];
      }

      const orderIds = [...new Set(allAssignmentOrders.map((o) => o.kitchen_order_id))];

      const [{ data: kitchenOrders }, { data: orderItems }] = await Promise.all([
        supabase
          .from("kitchen_orders")
          .select("id, customer_name, customer_phone, location_text, location_lat, location_lng, total_amount, notes")
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
            location_text: ko?.location_text || null,
            location_lat: ko?.location_lat || null,
            location_lng: ko?.location_lng || null,
            total_amount: ko?.total_amount || 0,
            notes: ko?.notes || null,
            items,
          };
        });
        return { ...assignment, orders } as Assignment;
      });
    },
    enabled: !!partner,
    refetchInterval: 10000,
  });

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

  const updateAssignmentStatus = async (assignmentId: string, newStatus: "accepted" | "picked_up") => {
    setUpdatingId(assignmentId);
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === "picked_up" ? { picked_up_at: new Date().toISOString() } : {}),
    };

    const { error } = await supabase
      .from("delivery_assignments")
      .update(updateData)
      .eq("id", assignmentId);

    setUpdatingId(null);
    if (!error) {
      const messages: Record<string, string> = {
        accepted: "Order accepted! Head to kitchen 🏃",
        picked_up: "Order picked up! On the way 🚴",
      };
      toast.success(messages[newStatus]);
      queryClient.invalidateQueries({ queryKey: ["active-assignments"] });
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUpiScreenshot(file);
      setUpiPreview(URL.createObjectURL(file));
    }
  };

  const submitDelivery = async (assignmentId: string, paymentMode: "cash" | "upi") => {
    setSubmitting(true);

    let screenshotPath: string | null = null;

    if (paymentMode === "upi" && upiScreenshot) {
      const fileName = `${assignmentId}_${Date.now()}.${upiScreenshot.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("delivery-proofs")
        .upload(fileName, upiScreenshot);
      if (uploadError) {
        toast.error("Failed to upload UPI screenshot");
        setSubmitting(false);
        return;
      }
      screenshotPath = fileName;
    }

    const { error } = await supabase
      .from("delivery_assignments")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        payment_mode: paymentMode,
        ...(screenshotPath ? { upi_screenshot_path: screenshotPath } : {}),
      })
      .eq("id", assignmentId);

    setSubmitting(false);
    if (!error) {
      toast.success("Delivery complete! 🎉");
      setPaymentAssignmentId(null);
      setUpiScreenshot(null);
      setUpiPreview(null);
      queryClient.invalidateQueries({ queryKey: ["active-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["today-stats"] });
    } else {
      toast.error("Failed to mark delivered");
    }
  };

  if (!partner) return null;

  const statusLabel: Record<string, string> = {
    pending: "New Request",
    accepted: "Accepted",
    picked_up: "Picked Up",
  };

  const statusColor: Record<string, string> = {
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
              <Card key={assignment.id} className="overflow-hidden shadow-sm">
                {/* Assignment header */}
                <div className="px-4 py-3 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusColor[assignment.status] || ""} text-white border-0 text-[10px]`}>
                      {statusLabel[assignment.status] || assignment.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(assignment.assigned_at), "hh:mm a")}
                    </span>
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
                            <p className="font-semibold text-sm text-foreground">{order.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Cash</p>
                            <p className="text-sm font-heading font-bold text-foreground">₹{order.total_amount}</p>
                          </div>
                          <a
                            href={`tel:${order.customer_phone}`}
                            className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center"
                          >
                            <Phone className="w-3.5 h-3.5 text-success" />
                          </a>
                        </div>
                      </div>

                      {(order.location_lat && order.location_lng) ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${order.location_lat},${order.location_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/5 px-3 py-1.5 rounded-md"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          Open in Maps
                        </a>
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
                    </div>
                  ))}
                </div>

                {/* Action button per assignment */}
                <div className="px-4 pb-4 pt-1">
                  {assignment.status === "pending" && (
                    <Button
                      onClick={() => updateAssignmentStatus(assignment.id, "accepted")}
                      disabled={updatingId === assignment.id}
                      className="w-full h-11 text-sm font-semibold gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {updatingId === assignment.id ? "Accepting..." : "Accept Order"}
                    </Button>
                  )}
                  {assignment.status === "accepted" && (
                    <Button
                      onClick={() => updateAssignmentStatus(assignment.id, "picked_up")}
                      disabled={updatingId === assignment.id}
                      className="w-full h-11 text-sm font-semibold gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      <Bike className="w-4 h-4" />
                      {updatingId === assignment.id ? "Updating..." : "Mark Picked Up"}
                    </Button>
                  )}
                  {assignment.status === "picked_up" && (
                    <Button
                      onClick={() => setPaymentAssignmentId(assignment.id)}
                      className="w-full h-11 text-sm font-semibold gap-2 bg-success hover:bg-success/90"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Delivered
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
      {paymentAssignmentId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-card w-full max-w-md rounded-t-2xl p-6 space-y-5 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-foreground">Payment Method</h3>
              <button onClick={() => { setPaymentAssignmentId(null); setUpiScreenshot(null); setUpiPreview(null); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">How did the customer pay?</p>

            <Button
              onClick={() => submitDelivery(paymentAssignmentId, "cash")}
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
                onClick={() => submitDelivery(paymentAssignmentId, "upi")}
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
