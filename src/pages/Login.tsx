import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePartner } from "@/hooks/usePartner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Phone, ArrowRight } from "lucide-react";
import logo from "@/assets/logo.png";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { setPartner } = usePartner();
  const navigate = useNavigate();

  const normalizePhone = (input: string) => {
    const digits = input.replace(/\D/g, "");
    return digits.slice(-10);
  };

  const handleLogin = async () => {
    const normalized = normalizePhone(phone);
    if (normalized.length !== 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("delivery_partners")
      .select("*")
      .eq("phone", normalized)
      .single();

    setLoading(false);

    if (error || !data) {
      toast.error("You are not registered as a delivery partner. Contact manager.");
      return;
    }

    localStorage.setItem("delivery_partner", JSON.stringify(data));
    setPartner(data);
    toast.success(`Welcome back, ${data.name}!`);
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="Khanismita Recipes Partners" className="w-28 h-28 rounded-full shadow-lg" />
          <h1 className="text-2xl font-heading font-bold text-foreground">Partner Login</h1>
          <p className="text-sm text-muted-foreground text-center">Enter your registered phone number to get started</p>
        </div>

        <Card className="p-6 space-y-4 shadow-md border-border">
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="tel"
              placeholder="10-digit phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="pl-10 h-12 text-base"
              maxLength={13}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
          </div>
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-12 text-base font-semibold gap-2"
          >
            {loading ? "Checking..." : "Login"}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </Button>
        </Card>
      </div>
    </div>
  );
}
