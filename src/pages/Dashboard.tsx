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

interface AssignmentOrder {
  id: string;
  kitchen_order_id: string;
  kitchen_orders: {
    id: string;
    customer_name: string;
    customer_phone: string;
    location_text: string | null;
    location_lat: number | null;
    location_lng: number | null;
    total_amount: number;
    notes: string | null;
    kitchen_order_items: {
      id: string;
      item_name: string;
      quantity: number;
      unit_price: number;
    }[];
  };
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
  orders: AssignmentOrder[];
}

export default function Dashboard() {
  const { partner, setPartner, logout } = usePartner();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [upiScreenshot, setUpiScreenshot] = useState<File | null>(null);
  const [upiPreview, setUpiPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: activeAssignment, isLoading } = useQuery({
    queryKey: ["active-assignment", partner?.id],
    queryFn: async () => {
      if (!partner) return null;

      const { data: assignments } = await supabase
        .from("delivery_assignments")
        .select("*")
        .eq("delivery_partner_id", partner.id)
        .in("status", ["pending", "accepted", "picked_up"])
        .order("assigned_at", { ascending: false })
        .limit(1);

      if (!assignments || assignments.length === 0) return null;
      const assignment = assignments[0];

      const { data: assignmentOrders } = await supabase
        .from("delivery_assignment_orders")
        .select("id, kitchen_order_id")
        .eq("assignment_id", assignment.id);

      if (!assignmentOrders || assignmentOrders.length === 0) {
        return { ...assignment, orders: [] } as Assignment;
      }

      const orderIds = assignmentOrders.map((o) => o.kitchen_order_id);
      const { data: kitchenOrders } = await supabase
        .from("kitchen_orders")
        .select("id, customer_name, customer_phone, location_text, location_lat, location_lng, total_amount, notes")
        .in("id", orderIds);

      const { data: orderItems } = await supabase
        .from("kitchen_order_items")
        .select("id, order_id, item_name, quantity, unit_price")
        .in("order_id", orderIds);

      const ordersWithDetails = assignmentOrders.map((ao) => {
        const ko = kitchenOrders?.find((k) => k.id === ao.kitchen_order_id);
        const items = orderItems?.filter((i) => i.order_id === ao.kitchen_order_id) || [];
        return {
          ...ao,
          kitchen_orders: { ...ko, kitchen_order_items: items },
        };
      }) as AssignmentOrder[];

      return { ...assignment, orders: ordersWithDetails } as Assignment;
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
          queryClient.invalidateQueries({ queryKey: ["active-assignment"] });
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

  const updateAssignmentStatus = async (newStatus: "accepted" | "picked_up") => {
    if (!activeAssignment) return;
    const updateData = {
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === "picked_up" ? { picked_up_at: new Date().toISOString() } : {}),
    };

    const { error } = await supabase
      .from("delivery_assignments")
      .update(updateData)
      .eq("id", activeAssignment.id);

    if (!error) {
      const messages: Record<string, string> = {
        accepted: "Order accepted! Head to kitchen 🏃",
        picked_up: "Order picked up! On the way 🚴",
      };
      toast.success(messages[newStatus]);
      queryClient.invalidateQueries({ queryKey: ["active-assignment"] });
    } else {
      toast.error("Failed to update status");
    }
  };

  const handleMarkDelivered = () => {
    setShowPaymentModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUpiScreenshot(file);
      setUpiPreview(URL.createObjectURL(file));
    }
  };

  const submitDelivery = async (paymentMode: "cash" | "upi") => {
    if (!activeAssignment) return;
    setSubmitting(true);

    let screenshotPath: string | null = null;

    if (paymentMode === "upi" && upiScreenshot) {
      const fileName = `${activeAssignment.id}_${Date.now()}.${upiScreenshot.name.split('.').pop()}`;
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
      .eq("id", activeAssignment.id);

    setSubmitting(false);
    if (!error) {
      toast.success("Delivery complete! 🎉");
      setShowPaymentModal(false);
      setUpiScreenshot(null);
      setUpiPreview(null);
      queryClient.invalidateQueries({ queryKey: ["active-assignment"] });
      queryClient.invalidateQueries({ queryKey: ["today-stats"] });
    } else {
      toast.error("Failed to mark delivered");
    }
  };

  if (!partner) return null;

  const statusLabel: Record<string, string> = {
    pending: "New Order",
    accepted: "Accepted",
    picked_up: "Picked Up",
  };

  const statusColor: Record<string, string> = {
    pending: "bg-amber-500",
    accepted: "bg-blue-500",
    picked_up: "bg-primary",
  };

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

      {/* Active Assignment */}
      <div className="px-4 pt-4">
        {isLoading ? (
          <Card className="p-6 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </Card>
        ) : activeAssignment ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-foreground">Active Assignment</h3>
              <Badge className={`${statusColor[activeAssignment.status] || ""} text-white border-0`}>
                {statusLabel[activeAssignment.status] || activeAssignment.status}
              </Badge>
            </div>

            {/* Summary banner */}
            <Card className="p-4 bg-accent/10 border-accent/30 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total to Collect</p>
                  <p className="text-2xl font-heading font-bold text-foreground">₹{activeAssignment.total_cash_to_collect}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground font-medium">Your Fee</p>
                  <p className="text-lg font-heading font-bold text-success">₹{activeAssignment.delivery_fee}</p>
                </div>
              </div>
            </Card>

            {/* Orders - each with cash to collect */}
            {activeAssignment.orders.map((order, idx) => (
              <Card key={order.id} className="p-4 space-y-3 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <span className="text-xs font-bold text-primary-foreground">{idx + 1}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{order.kitchen_orders.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{order.kitchen_orders.customer_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Collect</p>
                      <p className="text-sm font-heading font-bold text-foreground">₹{order.kitchen_orders.total_amount}</p>
                    </div>
                    <a
                      href={`tel:${order.kitchen_orders.customer_phone}`}
                      className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center"
                    >
                      <Phone className="w-4 h-4 text-success" />
                    </a>
                  </div>
                </div>

                {/* Location */}
                {(order.kitchen_orders.location_lat && order.kitchen_orders.location_lng) ? (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${order.kitchen_orders.location_lat},${order.kitchen_orders.location_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/5 px-3 py-2 rounded-md"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    Open in Maps
                  </a>
                ) : order.kitchen_orders.location_text ? (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {order.kitchen_orders.location_text}
                  </div>
                ) : null}

                {/* Items */}
                <div className="space-y-1">
                  {order.kitchen_orders.kitchen_order_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-xs text-muted-foreground">
                      <span>{item.quantity} × {item.item_name}</span>
                      <span>₹{item.quantity * item.unit_price}</span>
                    </div>
                  ))}
                </div>

                {order.kitchen_orders.notes && (
                  <p className="text-xs text-muted-foreground italic bg-muted px-3 py-1.5 rounded">
                    Note: {order.kitchen_orders.notes}
                  </p>
                )}
              </Card>
            ))}

            {/* Action Buttons based on status */}
            {activeAssignment.status === "pending" && (
              <Button
                onClick={() => updateAssignmentStatus("accepted")}
                className="w-full h-12 text-base font-semibold gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Accept Order
              </Button>
            )}
            {activeAssignment.status === "accepted" && (
              <Button
                onClick={() => updateAssignmentStatus("picked_up")}
                className="w-full h-12 text-base font-semibold gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Bike className="w-5 h-5" />
                Mark Picked Up
              </Button>
            )}
            {activeAssignment.status === "picked_up" && (
              <Button
                onClick={handleMarkDelivered}
                className="w-full h-12 text-base font-semibold gap-2 bg-success hover:bg-success/90"
              >
                <CheckCircle2 className="w-5 h-5" />
                Mark Delivered
              </Button>
            )}
          </div>
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
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-card w-full max-w-md rounded-t-2xl p-6 space-y-5 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-lg text-foreground">Payment Method</h3>
              <button onClick={() => { setShowPaymentModal(false); setUpiScreenshot(null); setUpiPreview(null); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">How did the customer pay?</p>

            {/* Cash option */}
            <Button
              onClick={() => submitDelivery("cash")}
              disabled={submitting}
              className="w-full h-12 text-base font-semibold gap-2"
              variant="outline"
            >
              <IndianRupee className="w-5 h-5" />
              {submitting ? "Submitting..." : "Cash Collected"}
            </Button>

            {/* UPI option */}
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
                onClick={() => submitDelivery("upi")}
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
