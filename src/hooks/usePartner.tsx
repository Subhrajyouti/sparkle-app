import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Partner {
  id: string;
  name: string;
  phone: string;
  is_active: boolean;
}

interface PartnerContextType {
  partner: Partner | null;
  setPartner: (p: Partner | null) => void;
  logout: () => void;
  loading: boolean;
}

const PartnerContext = createContext<PartnerContextType | null>(null);

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("delivery_partner");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Re-fetch to get latest is_active status
      supabase
        .from("delivery_partners")
        .select("*")
        .eq("id", parsed.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setPartner(data);
            localStorage.setItem("delivery_partner", JSON.stringify(data));
          } else {
            localStorage.removeItem("delivery_partner");
          }
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("delivery_partner");
    setPartner(null);
  };

  return (
    <PartnerContext.Provider value={{ partner, setPartner, loading, logout }}>
      {children}
    </PartnerContext.Provider>
  );
}

export function usePartner() {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartner must be used within PartnerProvider");
  return ctx;
}
