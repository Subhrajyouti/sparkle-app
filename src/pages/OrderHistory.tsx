import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Bike, History, LogOut, ChevronDown, ChevronUp,
  IndianRupee, Package, Clock
} from "lucide-react";

export default function OrderHistory() {
  const { partner, logout } = usePartner();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: assignments, isLoading } = useQuery({
    queryKey: ["history", partner?.id],
    queryFn: async () => {
      if (!partner) return [];

      const { data } = await supabase
        .from("delivery_assignments")
        .select("*")
        .eq("delivery_partner_id", partner.id)
        .in("status", ["delivered", "cancelled"])
        .order("delivered_at", { ascending: false })
        .limit(50);

      if (!data) return [];

      // Fetch order counts for each assignment
      const ids = data.map((a) => a.id);
      const { data: orderCounts } = await supabase
        .from("delivery_assignment_orders")
        .select("assignment_id, kitchen_order_id")
        .in("assignment_id", ids);

      return data.map((a) => ({
        ...a,
        orderCount: orderCounts?.filter((o) => o.assignment_id === a.id).length || 0,
        orderIds: orderCounts?.filter((o) => o.assignment_id === a.id).map((o) => o.kitchen_order_id) || [],
      }));
    },
    enabled: !!partner,
  });

  // Fetch expanded order details
  const { data: expandedOrders } = useQuery({
    queryKey: ["expanded-orders", expandedId],
    queryFn: async () => {
      if (!expandedId) return [];
      const assignment = assignments?.find((a) => a.id === expandedId);
      if (!assignment || assignment.orderIds.length === 0) return [];

      const { data: orders } = await supabase
        .from("kitchen_orders")
        .select("id, customer_name, customer_phone, total_amount")
        .in("id", assignment.orderIds);

      const { data: items } = await supabase
        .from("kitchen_order_items")
        .select("order_id, item_name, quantity")
        .in("order_id", assignment.orderIds);

      return orders?.map((o) => ({
        ...o,
        items: items?.filter((i) => i.order_id === o.id) || [],
      })) || [];
    },
    enabled: !!expandedId,
  });

  if (!partner) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-card border-b border-border px-4 py-4">
        <h1 className="font-heading font-bold text-lg text-foreground">Order History</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : !assignments || assignments.length === 0 ? (
          <Card className="p-8 flex flex-col items-center gap-3">
            <Clock className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No delivery history yet</p>
          </Card>
        ) : (
          assignments.map((a) => (
            <Card
              key={a.id}
              className="shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === "delivered" ? "default" : "destructive"} className="text-[10px]">
                        {a.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {a.orderCount} order{a.orderCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.delivered_at ? format(new Date(a.delivered_at), "dd MMM yyyy, hh:mm a") : format(new Date(a.assigned_at), "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Earned</p>
                      <p className="font-heading font-bold text-success text-sm">₹{a.delivery_fee}</p>
                    </div>
                    {expandedId === a.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </button>

              {expandedId === a.id && (
                <div className="px-4 pb-4 pt-0 border-t border-border space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground pt-2">
                    <span>Collected: ₹{a.total_cash_to_collect}</span>
                    <span>Fee: ₹{a.delivery_fee}</span>
                  </div>
                  {expandedOrders?.map((order) => (
                    <div key={order.id} className="bg-muted rounded-md p-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-foreground">{order.customer_name}</span>
                        <span className="text-muted-foreground">₹{order.total_amount}</span>
                      </div>
                      {order.items.map((item, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {item.quantity} × {item.item_name}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-2 flex items-center justify-around">
        <button
          onClick={() => navigate("/")}
          className="flex flex-col items-center gap-1 text-muted-foreground py-2 px-4"
        >
          <Bike className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-primary py-2 px-4">
          <History className="w-5 h-5" />
          <span className="text-[10px] font-medium">History</span>
        </button>
        <button
          onClick={logout}
          className="flex flex-col items-center gap-1 text-muted-foreground py-2 px-4"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
