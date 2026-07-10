// ── SINCRONIZACIÓN OFFLINE → SUPABASE ─────────────────────────────────────────
import { obtenerCola, limpiarItemCola } from "./db";

export const sincronizarCola = async (sb, onProgreso) => {
  const cola = await obtenerCola();
  if (cola.length === 0) return { sincronizados: 0, errores: 0 };

  let sincronizados = 0;
  let errores = 0;

  for (const op of cola) {
    try {
      if (op.tipo === "update_credito") {
        await sb.from("creditos").update(op.datos).eq("id", op.id_registro);
      } else if (op.tipo === "update_producto") {
        await sb.from("productos").update(op.datos).eq("id", op.id_registro);
      } else if (op.tipo === "insert_credito") {
        await sb.from("creditos").insert(op.datos);
      } else if (op.tipo === "insert_producto") {
        await sb.from("productos").insert(op.datos);
      } else if (op.tipo === "insert_cliente") {
        await sb.from("clientes").insert(op.datos);
      } else if (op.tipo === "insert_venta_contado") {
        await sb.from("ventas_contado").insert(op.datos);
      }
      await limpiarItemCola(op.id);
      sincronizados++;
      if (onProgreso) onProgreso(sincronizados, cola.length);
    } catch (err) {
      console.error("Error sincronizando:", op, err);
      errores++;
    }
  }

  return { sincronizados, errores };
};
