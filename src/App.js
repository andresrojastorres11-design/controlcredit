// Este archivo reemplaza el contenido de src/App.js
// Supabase ya está integrado - los datos se guardan en la nube

import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
const SUPABASE_URL = "https://jlwfuaokefwxbwdfvppo.supabase.co";
const SUPABASE_KEY = "sb_publishable_j-xJJUtfNfJJd_TkDnBeCg_dco6hFRA";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIGHT={bg:"#f4f6fb",card:"#ffffff",sidebar:"#0f1729",sidebarText:"#94a3b8",text:"#0f172a",sub:"#64748b",border:"#e2e8f0",accent:"#3b82f6",accent2:"#10b981",danger:"#ef4444",warning:"#f59e0b",purple:"#8b5cf6",input:"#ffffff",inputBorder:"#cbd5e1"};
const DARK={bg:"#0a0f1e",card:"#111827",sidebar:"#070d1a",sidebarText:"#64748b",text:"#f1f5f9",sub:"#94a3b8",border:"#1e2d45",accent:"#3b82f6",accent2:"#10b981",danger:"#ef4444",warning:"#f59e0b",purple:"#8b5cf6",input:"#0d1526",inputBorder:"#1e2d45"};

const EVOL=[{mes:"Ene",cobros:0,mora:0,prestamos:0},{mes:"Feb",cobros:0,mora:0,prestamos:0},{mes:"Mar",cobros:0,mora:0,prestamos:0},{mes:"Abr",cobros:0,mora:0,prestamos:0},{mes:"May",cobros:0,mora:0,prestamos:0},{mes:"Jun",cobros:0,mora:0,prestamos:0}];
const FRECUENCIAS=["Semanal","Quincenal","Mensual"];
const fmt=(n)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n||0);
const fmtFecha=(iso)=>{if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
const generarFechasCuotas=(fechaOtorg,frecuencia,cantCuotas)=>{if(!fechaOtorg||!cantCuotas)return[];const dias=frecuencia==="Semanal"?7:frecuencia==="Quincenal"?15:30;return Array.from({length:cantCuotas},(_,i)=>{const d=new Date(fechaOtorg);d.setDate(d.getDate()+dias*(i+1));return d.toISOString().slice(0,10);});};
const crearDetalleCuotas=(fechaOtorg,frecuencia,cantCuotas,valorCuota)=>{const fechas=generarFechasCuotas(fechaOtorg,frecuencia,cantCuotas);return fechas.map((fecha,i)=>({num:i+1,fechaVenc:fecha,montoPagado:0,estado:"Pendiente",fechaPago:null}));};

// Helpers para convertir entre snake_case (Supabase) y camelCase (App)
const clientFromDB=(r)=>({id:r.id,nombre:r.nombre,apellido:r.apellido,dni:r.dni||"",email:r.email||"",tel:r.tel||"",ciudad:r.ciudad||"",provincia:r.provincia||"",estado:r.estado||"Al día",score:r.score||75,sueldo:r.sueldo||"",ocupacion:r.ocupacion||"",empresa:r.empresa||"",estadoCivil:r.estado_civil||"",nacimiento:r.nacimiento||"",notas:r.notas||""});
const creditoFromDB=(r)=>({id:r.id,clienteId:r.cliente_id,clienteNombre:r.cliente_nombre,monto:r.monto,totalCobrar:r.total_cobrar,ganancia:r.ganancia,cuotas:r.cuotas,cuotasPagadas:r.cuotas_pagadas||0,valorCuota:r.valor_cuota,saldoCobrado:r.saldo_cobrado||0,saldoPendiente:r.saldo_pendiente,frecuencia:r.frecuencia,fechaOtorg:r.fecha_otorg,proximoPago:r.proximo_pago,estado:r.estado,comentarios:r.comentarios||"",historial:r.historial||[],detalleCuotas:r.detalle_cuotas||[]});
const productoFromDB=(r)=>({id:r.id,clienteId:r.cliente_id,clienteNombre:r.cliente_nombre,producto:r.producto,inversion:r.inversion,precioFinanciado:r.precio_financiado,ganancia:r.ganancia,cuotas:r.cuotas,cuotasPagadas:r.cuotas_pagadas||0,saldoCobrado:r.saldo_cobrado||0,valorCuota:r.valor_cuota,estado:r.estado,frecuencia:r.frecuencia});

// ── PDF ENGINE ────────────────────────────────────────────────────────────────
const abrirPDF=(html,nombre)=>{
  const estiloImpresion=`<style>@media print{@page{margin:15mm;size:A4}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
  const fullHtml=`<!DOCTYPE html><html><head><meta charset="UTF-8">${estiloImpresion}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;padding:24px 28px;border-radius:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:26px;font-weight:900;letter-spacing:-1px}.logo span{opacity:0.7}.subtitulo{font-size:11px;opacity:0.8;margin-top:3px}.seccion{margin-bottom:18px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.seccion-titulo{background:#f8fafc;padding:10px 16px;font-weight:700;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0}.seccion-body{padding:14px 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;text-align:left}th{font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:0.04em}tr:last-child td{border-bottom:none}.total-row td{background:#1e3a8a;color:#fff;font-weight:700;border:none;padding:10px 12px}.metrica{display:inline-block;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 16px;margin:4px;min-width:120px;text-align:center}.metrica-label{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:3px}.metrica-valor{font-size:16px;font-weight:900;color:#1e40af}.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}.badge-verde{background:#d1fae5;color:#065f46}.badge-rojo{background:#fee2e2;color:#991b1b}.badge-amarillo{background:#fef3c7;color:#92400e}.footer{text-align:center;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}</style></head><body>${html}<script>window.onload=()=>{window.print();}<\/script></body></html>`;
  const win=window.open("","_blank");
  if(win){win.document.write(fullHtml);win.document.close();}
};

// PDF de crédito individual
const generatePDF=(credito)=>{
  const fecha=new Date().toLocaleDateString("es-AR");
  const filas=(credito.detalleCuotas||[]).map(d=>{
    const saldoCuota=Math.max(0,(credito.valorCuota||0)-d.montoPagado);
    const badgeClass=d.estado==="Pagada"?"badge-verde":d.estado==="Parcial"?"badge-amarillo":"badge-rojo";
    return`<tr><td style="font-weight:700">${d.num}</td><td>${fmtFecha(d.fechaVenc)}</td><td>${fmt(credito.valorCuota)}</td><td style="color:#10b981;font-weight:600">${fmt(d.montoPagado)}</td><td style="color:#ef4444;font-weight:600">${fmt(saldoCuota)}</td><td><span class="badge ${badgeClass}">${d.estado}</span></td></tr>`;
  }).join("");
  const pct=Math.round((credito.cuotasPagadas/credito.cuotas)*100);
  const html=`
    <div class="header">
      <div><div class="logo">Control<span>Credit</span></div><div class="subtitulo">Sistema de Gestión Financiera</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700">Estado de Deuda</div><div style="font-size:11px;opacity:0.8">Generado: ${fecha}</div></div>
    </div>
    <div class="seccion">
      <div class="seccion-titulo">Datos del cliente</div>
      <div class="seccion-body">
        <table><tr><td><strong>Cliente:</strong> ${credito.clienteNombre}</td><td><strong>Estado:</strong> <span class="badge ${credito.estado==="Al día"?"badge-verde":credito.estado==="Moroso"?"badge-rojo":"badge-amarillo"}">${credito.estado}</span></td><td><strong>Frecuencia:</strong> ${credito.frecuencia}</td><td><strong>Fecha otorgamiento:</strong> ${fmtFecha(credito.fechaOtorg)}</td></tr></table>
      </div>
    </div>
    <div class="seccion">
      <div class="seccion-titulo">Resumen financiero</div>
      <div class="seccion-body" style="text-align:center">
        <div class="metrica"><div class="metrica-label">Valor de cuota</div><div class="metrica-valor">${fmt(credito.valorCuota)}</div></div>
        <div class="metrica"><div class="metrica-label">Ya abonado</div><div class="metrica-valor" style="color:#10b981">${fmt(credito.saldoCobrado)}</div></div>
        <div class="metrica"><div class="metrica-label">Saldo pendiente</div><div class="metrica-valor" style="color:#ef4444">${fmt(credito.saldoPendiente)}</div></div>
        <div class="metrica"><div class="metrica-label">Cuotas pagadas</div><div class="metrica-valor">${credito.cuotasPagadas}/${credito.cuotas}</div></div>
        <div class="metrica"><div class="metrica-label">Progreso</div><div class="metrica-valor">${pct}%</div></div>
      </div>
    </div>
    ${filas?`<div class="seccion"><div class="seccion-titulo">Detalle de cuotas</div><div class="seccion-body"><table><tr><th>#</th><th>Vencimiento</th><th>Valor cuota</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr>${filas}</table></div></div>`:""}
    <div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;font-size:11px;color:#1e40af;border-radius:0 8px 8px 0;margin-bottom:16px">
      ⚠️ Documento informativo. No implica reconocimiento de deuda. Los montos pueden estar sujetos a actualizaciones.
    </div>
    <div class="footer">ControlCredit &copy; ${new Date().getFullYear()} — Documento generado automáticamente — No válido como recibo de pago</div>
  `;
  abrirPDF(html,`Credito_${credito.clienteNombre.replace(/ /g,"_")}`);
};

// PDF de reporte mensual
const generateReporteMensual=(creditos,clientes,productos,mes,anio)=>{
  const fecha=new Date().toLocaleDateString("es-AR");
  const nombreMes=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes-1];
  const fechaDesde=`${anio}-${String(mes).padStart(2,"0")}-01`;
  const fechaHasta=`${anio}-${String(mes).padStart(2,"0")}-${new Date(anio,mes,0).getDate()}`;
  // Créditos otorgados ese mes
  const creditosMes=creditos.filter(c=>c.fechaOtorg>=fechaDesde&&c.fechaOtorg<=fechaHasta);
  // Pagos recibidos ese mes (cuotas pagadas con fecha en el mes)
  const pagosMes=creditos.flatMap(c=>(c.historial||[]).filter(h=>h.tipo==="pago"||h.tipo==="pago_cuota").filter(h=>{if(!h.fecha)return false;const partes=h.fecha.split("/");if(partes.length<3)return false;const fechaH=`${partes[2]}-${partes[1].padStart(2,"0")}-${partes[0].padStart(2,"0")}`;return fechaH>=fechaDesde&&fechaH<=fechaHasta;}));
  const totalPagadoMes=pagosMes.reduce((s,h)=>s+(h.monto||0),0);
  // Métricas generales
  const creditosActivos=creditos.filter(c=>c.estado!=="Finalizado");
  const totalEnLaCalle=creditosActivos.reduce((s,c)=>s+(c.monto-c.monto*(c.cuotasPagadas/c.cuotas)),0);
  const totalPorCobrar=creditosActivos.reduce((s,c)=>s+c.saldoPendiente,0);
  const gananciaTotal=creditos.reduce((s,c)=>s+c.ganancia,0);
  const gananciaReal=creditos.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0);
  const morosos=clientes.filter(c=>c.estado==="Moroso");
  const moraTotal=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado").reduce((s,c)=>s+c.saldoPendiente,0);
  const totalInvertido=creditos.reduce((s,c)=>s+c.monto,0)+productos.reduce((s,p)=>s+p.inversion,0);
  const rendimiento=totalInvertido>0?((gananciaTotal/totalInvertido)*100).toFixed(1):0;
  const filasCredMes=creditosMes.map(c=>`<tr><td>${c.clienteNombre}</td><td>${fmt(c.monto)}</td><td>${fmt(c.totalCobrar)}</td><td>${fmt(c.ganancia)}</td><td>${c.frecuencia}</td><td><span class="badge ${c.estado==="Al día"?"badge-verde":c.estado==="Moroso"?"badge-rojo":"badge-amarillo"}">${c.estado}</span></td></tr>`).join("");
  const filasMorosos=morosos.map(m=>{const deuda=creditos.filter(c=>c.clienteId===m.id&&c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0);return`<tr><td>${m.nombre} ${m.apellido}</td><td>${m.tel||"-"}</td><td style="color:#ef4444;font-weight:700">${fmt(deuda)}</td></tr>`;}).join("");
  const html=`
    <div class="header">
      <div><div class="logo">Control<span>Credit</span></div><div class="subtitulo">Reporte Mensual — ${nombreMes} ${anio}</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700">Período</div><div style="font-size:11px;opacity:0.8">01/${String(mes).padStart(2,"0")}/${anio} al ${new Date(anio,mes,0).getDate()}/${String(mes).padStart(2,"0")}/${anio}</div><div style="font-size:10px;opacity:0.7;margin-top:4px">Generado: ${fecha}</div></div>
    </div>
    <div class="seccion">
      <div class="seccion-titulo">📊 Métricas generales del negocio</div>
      <div class="seccion-body" style="text-align:center">
        <div class="metrica"><div class="metrica-label">Plata en la calle</div><div class="metrica-valor">${fmt(totalEnLaCalle)}</div></div>
        <div class="metrica"><div class="metrica-label">Por cobrar total</div><div class="metrica-valor">${fmt(totalPorCobrar)}</div></div>
        <div class="metrica"><div class="metrica-label">Total invertido</div><div class="metrica-valor">${fmt(totalInvertido)}</div></div>
        <div class="metrica"><div class="metrica-label">Ganancia esperada</div><div class="metrica-valor" style="color:#8b5cf6">${fmt(gananciaTotal)}</div></div>
        <div class="metrica"><div class="metrica-label">Ganancia realizada</div><div class="metrica-valor" style="color:#10b981">${fmt(gananciaReal)}</div></div>
        <div class="metrica"><div class="metrica-label">Rendimiento</div><div class="metrica-valor" style="color:#8b5cf6">${rendimiento}%</div></div>
        <div class="metrica"><div class="metrica-label">Mora total</div><div class="metrica-valor" style="color:#ef4444">${fmt(moraTotal)}</div></div>
        <div class="metrica"><div class="metrica-label">Cobrado en el mes</div><div class="metrica-valor" style="color:#10b981">${fmt(totalPagadoMes)}</div></div>
      </div>
    </div>
    <div class="seccion">
      <div class="seccion-titulo">📋 Resumen del mes</div>
      <div class="seccion-body">
        <table>
          <tr><td>Total de clientes</td><td style="font-weight:700">${clientes.length}</td><td>Clientes al día</td><td style="font-weight:700;color:#10b981">${clientes.filter(c=>c.estado==="Al día"||c.estado==="Premium").length}</td></tr>
          <tr><td>Clientes morosos</td><td style="font-weight:700;color:#ef4444">${morosos.length}</td><td>Créditos activos</td><td style="font-weight:700">${creditosActivos.length}</td></tr>
          <tr><td>Créditos otorgados este mes</td><td style="font-weight:700">${creditosMes.length}</td><td>Productos financiados activos</td><td style="font-weight:700">${productos.filter(p=>p.estado==="Activo").length}</td></tr>
          <tr><td>Capital otorgado este mes</td><td style="font-weight:700">${fmt(creditosMes.reduce((s,c)=>s+c.monto,0))}</td><td>Pagos registrados este mes</td><td style="font-weight:700">${pagosMes.length}</td></tr>
        </table>
      </div>
    </div>
    ${creditosMes.length>0?`<div class="seccion"><div class="seccion-titulo">💳 Créditos otorgados en ${nombreMes} ${anio}</div><div class="seccion-body"><table><tr><th>Cliente</th><th>Capital</th><th>Total cobrar</th><th>Ganancia</th><th>Frecuencia</th><th>Estado</th></tr>${filasCredMes}</table></div></div>`:""}
    ${morosos.length>0?`<div class="seccion"><div class="seccion-titulo">⚠️ Clientes morosos (${morosos.length})</div><div class="seccion-body"><table><tr><th>Cliente</th><th>Teléfono</th><th>Deuda total</th></tr>${filasMorosos}</table></div></div>`:""}
    <div class="footer">ControlCredit &copy; ${new Date().getFullYear()} — Reporte ${nombreMes} ${anio} — Documento confidencial</div>
  `;
  abrirPDF(html,`Reporte_${nombreMes}_${anio}`);
};

// PDF de perfil de cliente
const generatePDFCliente=(cliente,creditos,productos)=>{
  const fecha=new Date().toLocaleDateString("es-AR");
  const credC=creditos.filter(c=>c.clienteId===cliente.id);
  const prodC=productos.filter(p=>p.clienteId===cliente.id);
  const deudaTotal=credC.filter(c=>c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0);
  const totalPrestado=credC.reduce((s,c)=>s+c.monto,0);
  const totalCobrado=credC.reduce((s,c)=>s+c.saldoCobrado,0);
  const gananciaReal=credC.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0);

  const filasCreditos=credC.map(c=>{
    const pct=Math.round((c.cuotasPagadas/c.cuotas)*100);
    const badgeClass=c.estado==="Al día"?"badge-verde":c.estado==="Moroso"?"badge-rojo":"badge-amarillo";
    return`<tr>
      <td>${fmtFecha(c.fechaOtorg)}</td>
      <td>${fmt(c.monto)}</td>
      <td>${fmt(c.valorCuota)}</td>
      <td>${c.cuotasPagadas}/${c.cuotas} (${pct}%)</td>
      <td style="color:#10b981;font-weight:700">${fmt(c.saldoCobrado)}</td>
      <td style="color:#ef4444;font-weight:700">${fmt(c.saldoPendiente)}</td>
      <td>${c.frecuencia}</td>
      <td><span class="badge ${badgeClass}">${c.estado}</span></td>
    </tr>`;
  }).join("");

  const filasCuotasPorCredito=credC.map(c=>{
    const det=c.detalleCuotas||[];
    if(det.length===0)return"";
    const filasDetalle=det.map(d=>{
      const vc=d.valorCuotaEditado||c.valorCuota;
      const saldo=Math.max(0,vc-d.montoPagado);
      const badgeClass=d.estado==="Pagada"?"badge-verde":d.estado==="Parcial"?"badge-amarillo":"badge-rojo";
      return`<tr><td>${d.num}</td><td>${fmtFecha(d.fechaVenc)}</td><td>${fmt(vc)}${d.valorCuotaEditado&&d.valorCuotaEditado!==c.valorCuota?' <span class="badge badge-amarillo">+mora</span>':''}</td><td style="color:#10b981">${fmt(d.montoPagado)}</td><td style="color:#ef4444">${fmt(saldo)}</td><td><span class="badge ${badgeClass}">${d.estado}</span></td></tr>`;
    }).join("");
    return`<div class="seccion" style="margin-bottom:12px">
      <div class="seccion-titulo">Crédito otorgado ${fmtFecha(c.fechaOtorg)} — ${c.frecuencia} — ${c.estado}</div>
      <div class="seccion-body">
        <table><tr><th>#</th><th>Vencimiento</th><th>Valor cuota</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr>${filasDetalle}</table>
      </div>
    </div>`;
  }).join("");

  const filasProd=prodC.map(p=>{
    const pct=Math.round((p.cuotasPagadas/p.cuotas)*100);
    return`<tr><td>${p.producto}</td><td>${fmt(p.inversion)}</td><td>${fmt(p.precioFinanciado)}</td><td>${p.cuotasPagadas}/${p.cuotas} (${pct}%)</td><td style="color:#10b981;font-weight:700">${fmt(p.ganancia)}</td><td>${p.frecuencia}</td><td><span class="badge ${p.estado==="Activo"?"badge-verde":"badge-rojo"}">${p.estado}</span></td></tr>`;
  }).join("");

  const scoreColor=cliente.score>70?"#10b981":cliente.score>40?"#f59e0b":"#ef4444";
  const estadoBadge=cliente.estado==="Al día"||cliente.estado==="Premium"?"badge-verde":cliente.estado==="Moroso"?"badge-rojo":"badge-amarillo";

  const html=`
    <div class="header">
      <div><div class="logo">Control<span>Credit</span></div><div class="subtitulo">Resumen de Cliente</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700">${cliente.nombre} ${cliente.apellido}</div><div style="font-size:11px;opacity:0.8">Generado: ${fecha}</div></div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">📋 Datos personales</div>
      <div class="seccion-body">
        <table>
          <tr><td><strong>Nombre:</strong> ${cliente.nombre} ${cliente.apellido}</td><td><strong>DNI:</strong> ${cliente.dni||"—"}</td><td><strong>Estado:</strong> <span class="badge ${estadoBadge}">${cliente.estado}</span></td><td><strong>Score:</strong> <span style="color:${scoreColor};font-weight:700">${cliente.score||75}/100</span></td></tr>
          <tr><td><strong>Email:</strong> ${cliente.email||"—"}</td><td><strong>Teléfono:</strong> ${cliente.tel||"—"}</td><td><strong>Ciudad:</strong> ${cliente.ciudad||"—"}</td><td><strong>Provincia:</strong> ${cliente.provincia||"—"}</td></tr>
          <tr><td><strong>Ocupación:</strong> ${cliente.ocupacion||"—"}</td><td><strong>Empresa:</strong> ${cliente.empresa||"—"}</td><td><strong>Sueldo aprox.:</strong> ${cliente.sueldo?fmt(cliente.sueldo):"—"}</td><td><strong>Estado civil:</strong> ${cliente.estadoCivil||"—"}</td></tr>
          ${cliente.notas?`<tr><td colspan="4"><strong>Notas:</strong> ${cliente.notas}</td></tr>`:""}
        </table>
      </div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">💰 Resumen financiero del cliente</div>
      <div class="seccion-body" style="text-align:center">
        <div class="metrica"><div class="metrica-label">Total prestado</div><div class="metrica-valor">${fmt(totalPrestado)}</div></div>
        <div class="metrica"><div class="metrica-label">Ya cobrado</div><div class="metrica-valor" style="color:#10b981">${fmt(totalCobrado)}</div></div>
        <div class="metrica"><div class="metrica-label">Deuda activa</div><div class="metrica-valor" style="color:#ef4444">${fmt(deudaTotal)}</div></div>
        <div class="metrica"><div class="metrica-label">Ganancia generada</div><div class="metrica-valor" style="color:#8b5cf6">${fmt(gananciaReal)}</div></div>
        <div class="metrica"><div class="metrica-label">Créditos totales</div><div class="metrica-valor">${credC.length}</div></div>
        <div class="metrica"><div class="metrica-label">Ventas financiadas</div><div class="metrica-valor">${prodC.length}</div></div>
      </div>
    </div>

    ${credC.length>0?`<div class="seccion">
      <div class="seccion-titulo">💳 Historial de créditos (${credC.length})</div>
      <div class="seccion-body">
        <table><tr><th>Fecha</th><th>Capital</th><th>Cuota</th><th>Progreso</th><th>Cobrado</th><th>Pendiente</th><th>Frecuencia</th><th>Estado</th></tr>${filasCreditos}</table>
      </div>
    </div>`:""}

    ${filasCuotasPorCredito?`<div style="margin-bottom:4px"><strong style="font-size:12px;color:#475569;text-transform:uppercase;letter-spacing:0.05em">Detalle de cuotas por crédito</strong></div>${filasCuotasPorCredito}`:""}

    ${prodC.length>0?`<div class="seccion">
      <div class="seccion-titulo">🛒 Ventas financiadas (${prodC.length})</div>
      <div class="seccion-body">
        <table><tr><th>Producto</th><th>Inversión</th><th>Financiado</th><th>Cuotas</th><th>Ganancia</th><th>Frecuencia</th><th>Estado</th></tr>${filasProd}</table>
      </div>
    </div>`:""}

    <div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;font-size:11px;color:#1e40af;border-radius:0 8px 8px 0;margin-bottom:16px">
      Documento generado automáticamente por ControlCredit. Información confidencial — uso interno.
    </div>
    <div class="footer">ControlCredit &copy; ${new Date().getFullYear()} — ${fecha} — Documento confidencial</div>
  `;
  abrirPDF(html,`Cliente_${cliente.nombre}_${cliente.apellido}`);
};
const Icon=({name,size=18})=>{
  const i={
    dashboard:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    users:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    creditos:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    productos:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    cartera:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    alert:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    logout:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    sun:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    moon:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
    plus:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    search:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    edit:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>,
    close:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    pdf:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    check:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>,
    menu:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    coin:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a2.5 2.5 0 0 1 0 5H9"/></svg>,
    calendar:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    whatsapp:<svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>,
    back:<svg width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>,
  };
  return i[name]||null;
};

const Badge=({status})=>{
  const c={"Al día":{bg:"#d1fae5",color:"#065f46"},"Moroso":{bg:"#fee2e2",color:"#991b1b"},"Atrasado":{bg:"#fef3c7",color:"#92400e"},"Restringido":{bg:"#fce7f3",color:"#831843"},"Premium":{bg:"#ede9fe",color:"#4c1d95"},"Activo":{bg:"#dbeafe",color:"#1e40af"},"Finalizado":{bg:"#f1f5f9",color:"#475569"},"Pendiente":{bg:"#fef3c7",color:"#92400e"},"Refinanciado":{bg:"#ede9fe",color:"#4c1d95"}}[status]||{bg:"#f1f5f9",color:"#475569"};
  return <span style={{background:c.bg,color:c.color,padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{status}</span>;
};

const Modal=({open,onClose,title,children,t,wide})=>{
  if(!open)return null;
  return(
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}}>
      <div style={{background:t.card,borderRadius:16,padding:"28px 32px",minWidth:400,maxWidth:wide?800:660,width:"94%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.35)",border:`1px solid ${t.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
          <h2 style={{margin:0,fontSize:18,fontWeight:700,color:t.text}}>{title}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,padding:4}}><Icon name="close" size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Field=({label,value,onChange,type="text",options,t,placeholder})=>(
  <div style={{marginBottom:14}}>
    <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
    {options?(
      <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none"}}>
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    ):(
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||""} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
    )}
  </div>
);

const MetricCard=({label,value,icon,color,sub,t})=>(
  <div style={{background:t.card,borderRadius:14,padding:"18px 20px",border:`1px solid ${t.border}`,display:"flex",flexDirection:"column",gap:8,transition:"transform 0.2s"}}
    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
    onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <span style={{fontSize:11,color:t.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</span>
      <span style={{width:34,height:34,borderRadius:10,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",color}}><Icon name={icon} size={17}/></span>
    </div>
    <div style={{fontSize:21,fontWeight:800,color:t.text}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:t.sub}}>{sub}</div>}
  </div>
);

// ── TABLA DE CUOTAS ───────────────────────────────────────────────────────────
const TablaCuotas=({credito,onActualizar,t})=>{
  const [editIdx,setEditIdx]=useState(null);
  const [editFecha,setEditFecha]=useState("");
  const [editMonto,setEditMonto]=useState("");
  const [editValorCuota,setEditValorCuota]=useState("");
  const [modo,setModo]=useState("fecha"); // "fecha" | "pago" | "valor"
  const detalles=credito.detalleCuotas||[];

  const abrirEditFecha=(i)=>{setEditIdx(i);setEditFecha(detalles[i]?.fechaVenc||"");setModo("fecha");};
  const abrirEditPago=(i)=>{setEditIdx(i);setEditMonto(detalles[i]?.montoPagado?.toString()||"0");setModo("pago");};
  const abrirEditValor=(i)=>{setEditIdx(i);setEditValorCuota((detalles[i]?.valorCuotaEditado||credito.valorCuota)?.toString()||"");setModo("valor");};

  const guardarFecha=()=>{
    if(editIdx===null)return;
    const nuevos=[...detalles];
    nuevos[editIdx]={...nuevos[editIdx],fechaVenc:editFecha};
    const proxPendiente=nuevos.find(d=>d.estado!=="Pagada");
    onActualizar({...credito,detalleCuotas:nuevos,proximoPago:proxPendiente?.fechaVenc||credito.proximoPago});
    setEditIdx(null);
  };

  const guardarValorCuota=()=>{
    // Editar el valor de la cuota (ej: por mora o interés extra)
    if(editIdx===null)return;
    const nuevoValor=+editValorCuota||0;
    const nuevos=[...detalles];
    const valorAnterior=nuevos[editIdx].valorCuotaEditado||credito.valorCuota;
    const diferencia=nuevoValor-valorAnterior;
    nuevos[editIdx]={...nuevos[editIdx],valorCuotaEditado:nuevoValor};
    // Recalcular total cobrar y pendiente
    const nuevoTotal=credito.totalCobrar+diferencia;
    const totalCobrado=nuevos.reduce((s,d)=>s+d.montoPagado,0);
    const totalPendiente=Math.max(0,nuevoTotal-totalCobrado);
    onActualizar({...credito,detalleCuotas:nuevos,totalCobrar:nuevoTotal,saldoPendiente:totalPendiente,
      historial:[...credito.historial,{tipo:"edicion_valor_cuota",cuota:editIdx+1,valorAnterior,nuevoValor,fecha:new Date().toLocaleDateString("es-AR")}]});
    setEditIdx(null);
  };

  const guardarPago=()=>{
    if(editIdx===null)return;
    const p=+editMonto||0;
    const nuevos=[...detalles];
    const vc=nuevos[editIdx].valorCuotaEditado||credito.valorCuota;
    nuevos[editIdx]={...nuevos[editIdx],montoPagado:p,estado:p<=0?"Pendiente":p>=vc?"Pagada":"Parcial",fechaPago:p>0?new Date().toLocaleDateString("es-AR"):null};
    const totalCobrado=nuevos.reduce((s,d)=>s+d.montoPagado,0);
    const nuevoTotal=nuevos.reduce((s,d)=>s+(d.valorCuotaEditado||credito.valorCuota),0);
    const totalPendiente=Math.max(0,nuevoTotal-totalCobrado);
    const cuotasPagadas=nuevos.filter(d=>d.estado==="Pagada").length;
    const proxPendiente=nuevos.find(d=>d.estado!=="Pagada");
    const nuevoEstado=totalPendiente<=0?"Finalizado":credito.estado==="Moroso"&&p>0?"Atrasado":credito.estado;
    onActualizar({...credito,detalleCuotas:nuevos,saldoCobrado:totalCobrado,saldoPendiente:totalPendiente,
      totalCobrar:nuevoTotal,cuotasPagadas,proximoPago:proxPendiente?.fechaVenc||credito.proximoPago,estado:nuevoEstado,
      historial:[...credito.historial,{tipo:"pago_cuota",cuota:editIdx+1,monto:p,fecha:new Date().toLocaleDateString("es-AR")}]});
    setEditIdx(null);
  };

  if(detalles.length===0)return<div style={{padding:"12px",background:t.bg,borderRadius:8,fontSize:12,color:t.sub,textAlign:"center"}}>Sin cuotas registradas</div>;

  return(
    <div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:t.bg}}>{["#","Vencimiento","Valor cuota","Pagado","Saldo","Estado","Acciones"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:t.sub,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>
            {detalles.map((d,i)=>{
              const valorReal=d.valorCuotaEditado||credito.valorCuota;
              const saldoCuota=Math.max(0,valorReal-d.montoPagado);
              const editandoEsta=editIdx===i;
              const estadoColor=d.estado==="Pagada"?"#10b981":d.estado==="Parcial"?"#f59e0b":"#64748b";
              const tieneEdicion=!!d.valorCuotaEditado&&d.valorCuotaEditado!==credito.valorCuota;
              return(
                <tr key={i} style={{borderTop:`1px solid ${t.border}`,background:editandoEsta?`${t.accent}08`:tieneEdicion?"#fef3c720":"transparent"}}>
                  <td style={{padding:"8px 10px",fontWeight:700,color:t.text}}>{d.num}</td>
                  {/* FECHA */}
                  <td style={{padding:"8px 10px"}}>
                    {editandoEsta&&modo==="fecha"?(
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <input type="date" value={editFecha} onChange={e=>setEditFecha(e.target.value)} style={{padding:"4px 8px",borderRadius:6,border:`1px solid ${t.accent}`,background:t.input,color:t.text,fontSize:12,outline:"none"}}/>
                        <button onClick={guardarFecha} style={{background:t.accent,border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>OK</button>
                        <button onClick={()=>setEditIdx(null)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"4px 6px",color:t.sub,cursor:"pointer"}}><Icon name="close" size={12}/></button>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:t.text,fontWeight:600}}>{fmtFecha(d.fechaVenc)}</span>
                        <button onClick={()=>abrirEditFecha(i)} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,padding:2,display:"flex",alignItems:"center"}}><Icon name="edit" size={11}/></button>
                      </div>
                    )}
                  </td>
                  {/* VALOR CUOTA EDITABLE */}
                  <td style={{padding:"8px 10px"}}>
                    {editandoEsta&&modo==="valor"?(
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <input type="number" value={editValorCuota} onChange={e=>setEditValorCuota(e.target.value)} style={{width:100,padding:"4px 8px",borderRadius:6,border:`1px solid #f59e0b`,background:t.input,color:t.text,fontSize:12,outline:"none"}}/>
                        <button onClick={guardarValorCuota} style={{background:"#f59e0b",border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>OK</button>
                        <button onClick={()=>setEditIdx(null)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"4px 6px",color:t.sub,cursor:"pointer"}}><Icon name="close" size={12}/></button>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:tieneEdicion?"#f59e0b":t.text,fontWeight:tieneEdicion?700:600}}>{fmt(valorReal)}</span>
                        {tieneEdicion&&<span style={{fontSize:9,color:"#f59e0b",fontWeight:700,background:"#fef3c7",padding:"1px 5px",borderRadius:4}}>+mora</span>}
                        <button onClick={()=>abrirEditValor(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#f59e0b",padding:2,display:"flex",alignItems:"center"}} title="Editar valor por mora/interés"><Icon name="edit" size={11}/></button>
                      </div>
                    )}
                  </td>
                  {/* MONTO PAGADO */}
                  <td style={{padding:"8px 10px"}}>
                    {editandoEsta&&modo==="pago"?(
                      <div style={{display:"flex",gap:4,alignItems:"center"}}>
                        <input type="number" value={editMonto} onChange={e=>setEditMonto(e.target.value)} style={{width:90,padding:"4px 8px",borderRadius:6,border:`1px solid ${t.accent2}`,background:t.input,color:t.text,fontSize:12,outline:"none"}}/>
                        <button onClick={guardarPago} style={{background:t.accent2,border:"none",borderRadius:6,padding:"4px 8px",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:700}}>OK</button>
                        <button onClick={()=>setEditIdx(null)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"4px 6px",color:t.sub,cursor:"pointer"}}><Icon name="close" size={12}/></button>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{color:d.montoPagado>0?t.accent2:t.sub,fontWeight:d.montoPagado>0?700:400}}>{fmt(d.montoPagado)}</span>
                        <button onClick={()=>abrirEditPago(i)} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,padding:2,display:"flex",alignItems:"center"}}><Icon name="edit" size={11}/></button>
                      </div>
                    )}
                  </td>
                  <td style={{padding:"8px 10px",color:saldoCuota>0?"#ef4444":t.accent2,fontWeight:700}}>{fmt(saldoCuota)}</td>
                  <td style={{padding:"8px 10px"}}>
                    <span style={{color:estadoColor,fontWeight:600,fontSize:11}}>{d.estado}</span>
                    {d.fechaPago&&<div style={{fontSize:10,color:t.sub}}>{d.fechaPago}</div>}
                  </td>
                  <td style={{padding:"8px 10px"}}>
                    <div style={{display:"flex",gap:4}}>
                      <button onClick={()=>abrirEditFecha(i)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"4px 7px",cursor:"pointer",color:t.sub,fontSize:10,display:"flex",alignItems:"center",gap:2}} title="Editar fecha"><Icon name="calendar" size={11}/></button>
                      <button onClick={()=>abrirEditValor(i)} style={{background:"none",border:"1px solid #f59e0b",borderRadius:6,padding:"4px 7px",cursor:"pointer",color:"#f59e0b",fontSize:10,display:"flex",alignItems:"center",gap:2}} title="Editar valor por mora">$+</button>
                      <button onClick={()=>abrirEditPago(i)} style={{background:"none",border:`1px solid ${t.accent2}`,borderRadius:6,padding:"4px 7px",cursor:"pointer",color:t.accent2,fontSize:10,display:"flex",alignItems:"center",gap:2}} title="Registrar pago"><Icon name="check" size={11}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:16,marginTop:8,fontSize:11,color:t.sub}}>
        <span>🟢 Pagada</span><span>🟡 Parcial</span><span>⚫ Pendiente</span>
        <span style={{color:"#f59e0b"}}>🟠 $+ = editar valor por mora</span>
      </div>
    </div>
  );
};

// ── PERFIL CLIENTE ────────────────────────────────────────────────────────────
const PerfilCliente=({client,creditos,productos,setCreditos,onClose,onEdit,t})=>{
  const [expandidoCred,setExpandidoCred]=useState(null);
  const credC=creditos.filter(c=>c.clienteId===client.id);
  const prodC=productos.filter(p=>p.clienteId===client.id);
  const deudaActiva=credC.filter(c=>c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0);
  const totalPrestado=credC.reduce((s,c)=>s+c.monto,0);
  const totalCobrado=credC.reduce((s,c)=>s+c.saldoCobrado,0);
  const gananciaReal=credC.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0);
  const activos=credC.filter(c=>c.estado!=="Finalizado").length;
  const finalizados=credC.filter(c=>c.estado==="Finalizado").length;
  const av=`hsl(${(client.id*67)%360},55%,55%)`;
  const wa=`https://wa.me/54${(client.tel||"").replace(/\D/g,"")}`;
  const actualizarCredito=async(cred)=>{
    await sb.from("creditos").update({cuotas_pagadas:cred.cuotasPagadas,saldo_cobrado:cred.saldoCobrado,saldo_pendiente:cred.saldoPendiente,proximo_pago:cred.proximoPago,estado:cred.estado,historial:cred.historial,detalle_cuotas:cred.detalleCuotas}).eq("id",cred.id);
    setCreditos(cs=>cs.map(c=>c.id===cred.id?cred:c));
  };
  return(
    <div style={{background:t.bg,minHeight:"100%"}}>
      <div style={{background:t.card,borderBottom:`1px solid ${t.border}`,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{color:t.text,fontSize:14,fontWeight:700}}>{client.nombre} {client.apellido}</span>
          <Badge status={client.estado}/>
        </div>
        <button onClick={onClose} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:t.sub,display:"flex",alignItems:"center",gap:5,fontSize:13,fontWeight:600}}><Icon name="close" size={15}/>Cerrar</button>
      </div>
      <div style={{padding:"20px"}}>
        <div style={{background:t.card,borderRadius:16,border:`1px solid ${t.border}`,padding:"22px 26px",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:14}}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:56,height:56,borderRadius:"50%",background:av,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:20,flexShrink:0}}>{client.nombre[0]}{client.apellido[0]}</div>
              <div>
                <h2 style={{margin:"0 0 6px",fontSize:20,fontWeight:800,color:t.text}}>{client.nombre} {client.apellido}</h2>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:t.sub}}>DNI: <strong style={{color:t.text}}>{client.dni}</strong></span>
                  {client.tel&&<span style={{fontSize:12,color:t.sub}}>Tel: <strong style={{color:t.text}}>{client.tel}</strong></span>}
                  {client.ciudad&&<span style={{fontSize:12,color:t.sub}}>{client.ciudad}</span>}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {client.tel&&<a href={wa} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:7,background:"#25D366",color:"#fff",borderRadius:10,padding:"9px 14px",fontWeight:700,fontSize:13,textDecoration:"none"}}><Icon name="whatsapp" size={16}/>WhatsApp</a>}
              <button onClick={()=>generatePDFCliente(client,creditos,productos)} style={{display:"flex",alignItems:"center",gap:6,background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer"}}><Icon name="pdf" size={14}/>Exportar PDF</button>
              <button onClick={()=>onEdit(client)} style={{display:"flex",alignItems:"center",gap:6,background:"none",border:`1px solid ${t.border}`,borderRadius:10,padding:"9px 14px",fontWeight:600,fontSize:13,color:t.sub,cursor:"pointer"}}><Icon name="edit" size={14}/>Editar</button>
            </div>
          </div>
          <div style={{marginTop:16,maxWidth:380}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:t.sub}}>Score</span><span style={{fontSize:12,fontWeight:800,color:client.score>70?t.accent2:client.score>40?"#f59e0b":"#ef4444"}}>{client.score||75}/100</span></div>
            <div style={{height:7,borderRadius:4,background:t.border,overflow:"hidden"}}><div style={{width:`${client.score||75}%`,height:"100%",background:client.score>70?t.accent2:client.score>40?"#f59e0b":"#ef4444",borderRadius:4}}/></div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10,marginBottom:14}}>
          <MetricCard label="Deuda activa" value={fmt(deudaActiva)} icon="alert" color="#ef4444" t={t}/>
          <MetricCard label="Total prestado" value={fmt(totalPrestado)} icon="coin" color="#3b82f6" t={t}/>
          <MetricCard label="Cobrado" value={fmt(totalCobrado)} icon="check" color="#10b981" t={t}/>
          <MetricCard label="Ganancia" value={fmt(gananciaReal)} icon="cartera" color="#8b5cf6" t={t}/>
          <MetricCard label="Activos" value={activos} icon="creditos" color="#f59e0b" t={t}/>
          <MetricCard label="Finalizados" value={finalizados} icon="check" color="#64748b" t={t}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
          <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:"16px 18px"}}>
            <h3 style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:t.text}}>📋 Datos personales</h3>
            {[["Email",client.email],["Teléfono",client.tel],["Nacimiento",client.nacimiento],["Estado civil",client.estadoCivil],["Ciudad",client.ciudad],["Provincia",client.provincia]].map(([k,v])=>v?(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${t.border}`}}><span style={{fontSize:11,color:t.sub}}>{k}</span><span style={{fontSize:11,fontWeight:600,color:t.text}}>{v}</span></div>):null)}
          </div>
          <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:"16px 18px"}}>
            <h3 style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:t.text}}>💼 Trabajo</h3>
            {[["Ocupación",client.ocupacion],["Empresa",client.empresa],["Sueldo",client.sueldo?fmt(client.sueldo):null]].map(([k,v])=>v?(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${t.border}`}}><span style={{fontSize:11,color:t.sub}}>{k}</span><span style={{fontSize:11,fontWeight:600,color:t.text}}>{v}</span></div>):null)}
            {client.notas&&<div style={{marginTop:10}}><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notas</div><div style={{fontSize:11,color:t.text,background:t.bg,borderRadius:7,padding:"8px 10px"}}>{client.notas}</div></div>}
          </div>
        </div>
        <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:"18px 20px",marginBottom:12}}>
          <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:t.text}}>💳 Créditos ({credC.length})</h3>
          {credC.length===0?<div style={{textAlign:"center",padding:"20px",color:t.sub,fontSize:13}}>Sin créditos registrados</div>:(
            <div style={{display:"grid",gap:10}}>
              {credC.map(c=>{
                const pct=Math.round((c.cuotasPagadas/c.cuotas)*100);
                const abierto=expandidoCred===c.id;
                return(
                  <div key={c.id} style={{borderRadius:10,border:`1px solid ${c.estado==="Moroso"?"#fca5a5":c.estado==="Atrasado"?"#fcd34d":t.border}`,overflow:"hidden"}}>
                    <div style={{padding:"12px 16px",background:t.bg}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
                        <div>
                          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:13,fontWeight:700,color:t.text}}>Otorgado: {fmtFecha(c.fechaOtorg)}</span>
                            <Badge status={c.estado}/>
                            <span style={{fontSize:11,color:t.accent,fontWeight:600,background:t.card,padding:"2px 7px",borderRadius:6,border:`1px solid ${t.border}`}}>{c.frecuencia}</span>
                          </div>
                          <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11}}>
                            <span style={{color:t.sub}}>Capital: <strong style={{color:t.text}}>{fmt(c.monto)}</strong></span>
                            <span style={{color:t.sub}}>Cobrado: <strong style={{color:t.accent2}}>{fmt(c.saldoCobrado)}</strong></span>
                            <span style={{color:t.sub}}>Pendiente: <strong style={{color:"#ef4444"}}>{fmt(c.saldoPendiente)}</strong></span>
                            <span style={{color:t.sub}}>Cuota: <strong style={{color:t.text}}>{fmt(c.valorCuota)}</strong></span>
                          </div>
                        </div>
                        <button onClick={()=>setExpandidoCred(abierto?null:c.id)} style={{background:abierto?t.accent:"none",border:`1px solid ${t.accent}`,color:abierto?"#fff":t.accent,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
                          <Icon name="calendar" size={12}/>{abierto?"Ocultar":"Ver cuotas"}
                        </button>
                      </div>
                      <div style={{marginTop:10}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:10,color:t.sub}}>{c.cuotasPagadas}/{c.cuotas} cuotas</span><span style={{fontSize:10,fontWeight:700,color:t.text}}>{pct}%</span></div>
                        <div style={{height:6,borderRadius:3,background:t.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct>=100?t.accent2:pct>50?t.accent:"#f59e0b",borderRadius:3}}/></div>
                      </div>
                    </div>
                    {abierto&&<div style={{borderTop:`1px solid ${t.border}`,padding:"12px 16px",background:t.card}}><TablaCuotas credito={c} onActualizar={actualizarCredito} t={t}/></div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {prodC.length>0&&(
          <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:"18px 20px"}}>
            <h3 style={{margin:"0 0 12px",fontSize:14,fontWeight:700,color:t.text}}>🛒 Ventas financiadas ({prodC.length})</h3>
            {prodC.map(p=>{
              const pct=Math.round((p.cuotasPagadas/p.cuotas)*100);
              const vc=p.valorCuota||Math.round(p.precioFinanciado/p.cuotas);
              return(
                <div key={p.id} style={{padding:"12px 14px",background:t.bg,borderRadius:9,border:`1px solid ${t.border}`,marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontWeight:700,color:t.text,fontSize:13}}>{p.producto}</span><Badge status={p.estado}/></div></div>
                  <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11,marginBottom:6}}>
                    <span style={{color:t.sub}}>Inversión: <strong style={{color:t.text}}>{fmt(p.inversion)}</strong></span>
                    <span style={{color:t.sub}}>Financiado: <strong style={{color:t.text}}>{fmt(p.precioFinanciado)}</strong></span>
                    <span style={{color:t.sub}}>Ganancia: <strong style={{color:t.accent2}}>{fmt(p.ganancia)}</strong></span>
                  </div>
                  <div style={{height:5,borderRadius:3,background:t.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct>=100?t.accent2:t.accent,borderRadius:3}}/></div>
                  <div style={{fontSize:10,color:t.sub,marginTop:3}}>{p.cuotasPagadas}/{p.cuotas} · {pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── USUARIOS (hardcoded, admin puede agregar) ─────────────────────────────────
// Los usuarios se guardan en Supabase tabla "usuarios"
const usuarioFromDB=(r)=>({id:r.id,nombre:r.nombre,user:r.user_name,rol:r.rol||"empleado",activo:r.activo!==false});

// ── PANEL ADMIN USUARIOS ──────────────────────────────────────────────────────
const AdminUsuarios=({t})=>{
  const [usuarios,setUsuarios]=useState([]);
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({nombre:"",user_name:"",password:"",rol:"empleado"});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    sb.from("usuarios").select("*").then(({data})=>{if(data)setUsuarios(data.map(usuarioFromDB));});
  },[]);

  const save=async()=>{
    if(!form.nombre||!form.user_name||!form.password)return;
    setLoading(true);
    const {data}=await sb.from("usuarios").insert({nombre:form.nombre,user_name:form.user_name,password:form.password,rol:form.rol,activo:true}).select().single();
    if(data)setUsuarios(us=>[...us,usuarioFromDB(data)]);
    setLoading(false);setModal(false);setForm({nombre:"",user_name:"",password:"",rol:"empleado"});
  };

  const toggleActivo=async(u)=>{
    await sb.from("usuarios").update({activo:!u.activo}).eq("id",u.id);
    setUsuarios(us=>us.map(x=>x.id===u.id?{...x,activo:!x.activo}:x));
  };

  const del=async(id)=>{
    if(confirm("¿Eliminar usuario?")){ await sb.from("usuarios").delete().eq("id",id); setUsuarios(us=>us.filter(u=>u.id!==id)); }
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>👥 Panel de Usuarios</h1><p style={{color:t.sub,margin:0,fontSize:13}}>Solo visible para administradores</p></div>
        <button onClick={()=>setModal(true)} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nuevo usuario</button>
      </div>
      <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:t.bg}}>{["Nombre","Usuario","Rol","Estado","Acciones"].map(h=><th key={h} style={{padding:"11px 15px",textAlign:"left",fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>
            {usuarios.map(u=>(
              <tr key={u.id} style={{borderTop:`1px solid ${t.border}`}}>
                <td style={{padding:"12px 15px",fontWeight:600,color:t.text}}>{u.nombre}</td>
                <td style={{padding:"12px 15px",color:t.sub,fontSize:13}}>{u.user}</td>
                <td style={{padding:"12px 15px"}}><span style={{background:u.rol==="admin"?"#ede9fe":"#dbeafe",color:u.rol==="admin"?"#4c1d95":"#1e40af",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600}}>{u.rol}</span></td>
                <td style={{padding:"12px 15px"}}><span style={{background:u.activo?"#d1fae5":"#fee2e2",color:u.activo?"#065f46":"#991b1b",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600}}>{u.activo?"Activo":"Inactivo"}</span></td>
                <td style={{padding:"12px 15px"}}>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>toggleActivo(u)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",color:t.sub,fontSize:11,fontWeight:600}}>{u.activo?"Desactivar":"Activar"}</button>
                    <button onClick={()=>del(u.id)} style={{background:"none",border:"1px solid #fca5a5",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#ef4444"}}><Icon name="trash" size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length===0&&<tr><td colSpan={5} style={{padding:"30px",textAlign:"center",color:t.sub}}>No hay usuarios creados</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo usuario" t={t}>
        <Field label="Nombre completo *" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))} t={t}/>
        <Field label="Nombre de usuario *" value={form.user_name} onChange={v=>setForm(f=>({...f,user_name:v}))} t={t} placeholder="Ej: maria123"/>
        <Field label="Contraseña *" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} t={t}/>
        <Field label="Rol" value={form.rol} onChange={v=>setForm(f=>({...f,rol:v}))} options={["empleado","admin"]} t={t}/>
        <div style={{background:t.bg,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:t.sub}}>
          Los empleados solo ven sus propios clientes y créditos. Los admin ven todo.
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Crear usuario"}</button>
        </div>
      </Modal>
    </div>
  );
};
const Dashboard=({clients,creditos,productos,t})=>{
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const [mesPDF,setMesPDF]=useState(hoy.getMonth()+1);
  const [anioPDF,setAnioPDF]=useState(hoy.getFullYear());
  const [tabPagos,setTabPagos]=useState("aldia");

  const activos=creditos.filter(c=>c.estado!=="Finalizado");
  const plata=activos.reduce((s,c)=>s+(c.monto-c.monto*(c.cuotasPagadas/c.cuotas)),0);
  const porCobrar=activos.reduce((s,c)=>s+c.saldoPendiente,0);
  const ganEsp=creditos.reduce((s,c)=>s+c.ganancia,0);
  const ganReal=creditos.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0);
  const nMorosos=clients.filter(c=>c.estado==="Moroso").length;
  const nAlDia=clients.filter(c=>c.estado==="Al día"||c.estado==="Premium").length;
  const alertas=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado");
  const COLORS=["#3b82f6","#ef4444","#f59e0b","#8b5cf6"];
  const pie=[{name:"Al día",value:nAlDia},{name:"Morosos",value:nMorosos},{name:"Atrasados",value:clients.filter(c=>c.estado==="Atrasado").length}].filter(d=>d.value>0);

  // Flujo de efectivo
  const totalCobradoReal=creditos.reduce((s,c)=>s+c.saldoCobrado,0);
  const totalPendienteReal=creditos.reduce((s,c)=>s+c.saldoPendiente,0);
  const flujoTotal=totalCobradoReal+totalPendienteReal;
  const capitalRecuperado=creditos.reduce((s,c)=>s+c.monto*(c.cuotasPagadas/c.cuotas),0);
  const interesesCobrados=Math.max(0,totalCobradoReal-capitalRecuperado);
  const morasCobradas=creditos.reduce((s,c)=>{
    const det=c.detalleCuotas||[];
    return s+det.reduce((ss,d)=>{const extra=(d.valorCuotaEditado||0)-(c.valorCuota||0);return ss+(extra>0&&d.estado==="Pagada"?extra:0);},0);
  },0);

  // Pagos tabs
  const en3dias=new Date(hoy);en3dias.setDate(hoy.getDate()+3);
  const itemsPagos=activos.map(c=>{
    const proxFecha=c.proximoPago?new Date(c.proximoPago):null;
    if(proxFecha)proxFecha.setHours(0,0,0,0);
    const diffDias=proxFecha?Math.round((proxFecha-hoy)/(1000*60*60*24)):null;
    let cat="aldia";
    if(c.estado==="Moroso"||c.estado==="Atrasado"||(proxFecha&&diffDias<0))cat="moroso";
    else if(proxFecha&&diffDias<=3)cat="porvencer";
    return{...c,proxFecha,diffDias,cat};
  });
  const pagosAlDia=itemsPagos.filter(i=>i.cat==="aldia");
  const pagosPorVencer=itemsPagos.filter(i=>i.cat==="porvencer");
  const pagosMorosos=itemsPagos.filter(i=>i.cat==="moroso");
  const tabsConfig=[
    {id:"aldia",label:"Al día",count:pagosAlDia.length,color:"#10b981",bg:"#d1fae510",border:"#10b98130"},
    {id:"porvencer",label:"Por vencer",count:pagosPorVencer.length,color:"#f59e0b",bg:"#fef3c710",border:"#f59e0b30"},
    {id:"moroso",label:"Morosos",count:pagosMorosos.length,color:"#ef4444",bg:"#fee2e210",border:"#ef444430"},
  ];
  const listaActiva=tabPagos==="aldia"?pagosAlDia:tabPagos==="porvencer"?pagosPorVencer:pagosMorosos;
  const tabActiva=tabsConfig.find(tab=>tab.id===tabPagos);

  return(
    <div>
      <div style={{marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div><h1 style={{fontSize:24,fontWeight:800,color:t.text,margin:"0 0 4px"}}>Dashboard</h1><p style={{color:t.sub,margin:0,fontSize:14}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</p></div>
        <div style={{display:"flex",gap:8,alignItems:"center",background:t.card,padding:"10px 14px",borderRadius:12,border:`1px solid ${t.border}`}}>
          <span style={{fontSize:12,color:t.sub,fontWeight:600}}>Reporte:</span>
          <select value={mesPDF} onChange={e=>setMesPDF(+e.target.value)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:"none"}}>
            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={anioPDF} onChange={e=>setAnioPDF(+e.target.value)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:"none"}}>
            {[2024,2025,2026,2027].map(a=><option key={a} value={a}>{a}</option>)}
          </select>
          <button onClick={()=>generateReporteMensual(creditos,clients,productos,mesPDF,anioPDF)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <Icon name="pdf" size={14}/>Generar PDF
          </button>
        </div>
      </div>

      {alertas.length>0&&<div style={{background:"#fef3c7",border:"1px solid #fcd34d",borderRadius:12,padding:"12px 18px",marginBottom:20,display:"flex",gap:10,alignItems:"center"}}><Icon name="alert" size={18}/><span style={{color:"#92400e",fontSize:13,fontWeight:600}}>{alertas.length} crédito(s) requieren atención.</span></div>}
      {clients.length===0&&<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"40px",textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:12}}>🚀</div><div style={{fontSize:16,fontWeight:700,color:t.text,marginBottom:6}}>¡Bienvenido a ControlCredit!</div><div style={{fontSize:13,color:t.sub}}>Empezá agregando tu primer cliente.</div></div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:14,marginBottom:20}}>
        <MetricCard label="Plata en la calle" value={fmt(plata)} icon="coin" color="#3b82f6" sub="Capital no recuperado" t={t}/>
        <MetricCard label="Por cobrar" value={fmt(porCobrar)} icon="cartera" color="#10b981" t={t}/>
        <MetricCard label="Ganancia esperada" value={fmt(ganEsp-ganReal)} icon="creditos" color="#8b5cf6" sub="Ganancia pendiente" t={t}/>
        <MetricCard label="Ganancia realizada" value={fmt(ganReal)} icon="check" color="#10b981" t={t}/>
        <MetricCard label="Total clientes" value={clients.length} icon="users" color="#f59e0b" t={t}/>
        <MetricCard label="Morosos" value={nMorosos} icon="alert" color="#ef4444" t={t}/>
        <MetricCard label="Créditos activos" value={activos.length} icon="creditos" color="#3b82f6" t={t}/>
        <MetricCard label="Prod. activos" value={productos.filter(p=>p.estado==="Activo").length} icon="productos" color="#10b981" t={t}/>
      </div>

      {/* FLUJO DE EFECTIVO */}
      {creditos.length>0&&(
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 24px",marginBottom:20}}>
          <h3 style={{margin:"0 0 14px",fontSize:16,fontWeight:800,color:t.text}}>💵 Flujo de Efectivo</h3>
          <p style={{margin:"0 0 16px",fontSize:12,color:t.sub}}>Capital + intereses que circulan en tu negocio</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:16}}>
            <div style={{background:"#3b82f618",borderRadius:12,padding:"14px 18px",border:"1px solid #3b82f630"}}>
              <div style={{fontSize:10,color:"#3b82f6",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Total flujo proyectado</div>
              <div style={{fontSize:20,fontWeight:900,color:t.text}}>{fmt(flujoTotal)}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:2}}>Capital + intereses totales</div>
            </div>
            <div style={{background:"#10b98118",borderRadius:12,padding:"14px 18px",border:"1px solid #10b98130"}}>
              <div style={{fontSize:10,color:"#10b981",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Ya cobrado</div>
              <div style={{fontSize:20,fontWeight:900,color:"#10b981"}}>{fmt(totalCobradoReal)}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:2}}>Dinero que ya tenés en mano</div>
            </div>
            <div style={{background:"#ef444418",borderRadius:12,padding:"14px 18px",border:"1px solid #ef444430"}}>
              <div style={{fontSize:10,color:"#ef4444",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Pendiente de cobrar</div>
              <div style={{fontSize:20,fontWeight:900,color:"#ef4444"}}>{fmt(totalPendienteReal)}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:2}}>Falta recibir</div>
            </div>
            <div style={{background:"#8b5cf618",borderRadius:12,padding:"14px 18px",border:"1px solid #8b5cf630"}}>
              <div style={{fontSize:10,color:"#8b5cf6",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Intereses cobrados</div>
              <div style={{fontSize:20,fontWeight:900,color:"#8b5cf6"}}>{fmt(interesesCobrados)}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:2}}>Ganancia ya realizada</div>
            </div>
            {morasCobradas>0&&<div style={{background:"#f59e0b18",borderRadius:12,padding:"14px 18px",border:"1px solid #f59e0b30"}}>
              <div style={{fontSize:10,color:"#f59e0b",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Moras cobradas</div>
              <div style={{fontSize:20,fontWeight:900,color:"#f59e0b"}}>{fmt(morasCobradas)}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:2}}>Intereses por atrasos</div>
            </div>}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:t.sub,fontWeight:600}}>Progreso de cobro</span><span style={{fontSize:13,fontWeight:800,color:t.text}}>{flujoTotal>0?Math.round((totalCobradoReal/flujoTotal)*100):0}%</span></div>
          <div style={{height:10,borderRadius:5,background:t.border,overflow:"hidden"}}><div style={{width:`${flujoTotal>0?(totalCobradoReal/flujoTotal)*100:0}%`,height:"100%",background:"linear-gradient(90deg,#3b82f6,#10b981)",borderRadius:5}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:11,color:t.sub}}><span>Cobrado: {fmt(totalCobradoReal)}</span><span>Pendiente: {fmt(totalPendienteReal)}</span></div>
        </div>
      )}

      {/* PAGOS */}
      {creditos.length>0&&(
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,marginBottom:20,overflow:"hidden"}}>
          <div style={{padding:"18px 22px 0"}}>
            <h3 style={{margin:"0 0 14px",fontSize:16,fontWeight:800,color:t.text}}>💳 Pagos</h3>
            <div style={{display:"flex",gap:0,borderBottom:`1px solid ${t.border}`}}>
              {tabsConfig.map(tab=>(
                <button key={tab.id} onClick={()=>setTabPagos(tab.id)}
                  style={{display:"flex",alignItems:"center",gap:7,padding:"10px 20px",border:"none",borderBottom:tabPagos===tab.id?`3px solid ${tab.color}`:"3px solid transparent",background:"transparent",cursor:"pointer",fontWeight:tabPagos===tab.id?700:500,fontSize:13,color:tabPagos===tab.id?tab.color:t.sub,transition:"all 0.15s"}}>
                  <span style={{width:22,height:22,borderRadius:"50%",background:tabPagos===tab.id?tab.color:`${tab.color}40`,color:tabPagos===tab.id?"#fff":tab.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900}}>{tab.count}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{padding:"16px 22px",maxHeight:400,overflowY:"auto"}}>
            {listaActiva.length===0?(
              <div style={{textAlign:"center",padding:"28px 0",color:t.sub}}>
                <div style={{fontSize:32,marginBottom:8}}>{tabPagos==="aldia"?"✅":tabPagos==="porvencer"?"⏰":"🎉"}</div>
                <div style={{fontSize:13,fontWeight:600,color:t.text}}>
                  {tabPagos==="aldia"?"No hay créditos al día activos":tabPagos==="porvencer"?"Ningún vencimiento en los próximos 3 días":"No hay clientes morosos"}
                </div>
              </div>
            ):(
              <div style={{display:"grid",gap:10}}>
                {listaActiva.map(c=>{
                  const clienteInfo=clients.find(cl=>cl.id===c.clienteId);
                  const diffLabel=c.diffDias===null?"Sin fecha":c.diffDias<0?`Venció hace ${Math.abs(c.diffDias)} día${Math.abs(c.diffDias)!==1?"s":""}`  :c.diffDias===0?"Vence HOY":c.diffDias===1?"Vence mañana":`Vence en ${c.diffDias} días`;
                  return(
                    <div key={c.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:tabActiva.bg,borderRadius:10,border:`1px solid ${tabActiva.border}`,flexWrap:"wrap",gap:10}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:40,height:40,borderRadius:"50%",background:tabActiva.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15,flexShrink:0}}>{(c.clienteNombre||"?")[0].toUpperCase()}</div>
                        <div>
                          <div style={{fontWeight:700,color:t.text,fontSize:14}}>{c.clienteNombre}</div>
                          <div style={{fontSize:11,color:t.sub,display:"flex",gap:12,flexWrap:"wrap",marginTop:2}}>
                            <span>Cuota: <strong style={{color:t.text}}>{fmt(c.valorCuota)}</strong></span>
                            <span>Saldo: <strong style={{color:tabActiva.color}}>{fmt(c.saldoPendiente)}</strong></span>
                            <span>{c.frecuencia}</span>
                            <span style={{fontWeight:700,color:tabActiva.color}}>{diffLabel}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        {clienteInfo?.tel&&<a href={`https://wa.me/54${clienteInfo.tel.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,background:"#25D366",color:"#fff",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,textDecoration:"none"}}><Icon name="whatsapp" size={14}/>WhatsApp</a>}
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:11,color:t.sub}}>{c.cuotasPagadas}/{c.cuotas} cuotas</div>
                          <div style={{fontSize:10,color:t.sub}}>Próx: {fmtFecha(c.proximoPago)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {(creditos.length>0||clients.length>0)&&<div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:18,marginBottom:18}}>
        <div style={{background:t.card,borderRadius:14,padding:"20px 22px",border:`1px solid ${t.border}`}}>
          <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,color:t.text}}>Evolución mensual</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={EVOL}><defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke={t.border}/><XAxis dataKey="mes" tick={{fill:t.sub,fontSize:12}}/><YAxis tick={{fill:t.sub,fontSize:11}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/><Tooltip formatter={v=>fmt(v)} contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:8,color:t.text}}/><Area type="monotone" dataKey="cobros" stroke="#3b82f6" fill="url(#g1)" name="Cobros"/></AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:t.card,borderRadius:14,padding:"20px 22px",border:`1px solid ${t.border}`}}>
          <h3 style={{margin:"0 0 16px",fontSize:15,fontWeight:700,color:t.text}}>Clientes</h3>
          {pie.length>0?<ResponsiveContainer width="100%" height={190}><PieChart><Pie data={pie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">{pie.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:t.card,border:`1px solid ${t.border}`,borderRadius:8,color:t.text}}/><Legend formatter={v=><span style={{color:t.sub,fontSize:12}}>{v}</span>}/></PieChart></ResponsiveContainer>:<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:190,color:t.sub,fontSize:13}}>Sin datos aún</div>}
        </div>
      </div>}
    </div>
  );
};

const Clientes=({clients,setClients,creditos,setCreditos,productos,t})=>{
  const [search,setSearch]=useState("");
  const [filtro,setFiltro]=useState("Todos");
  const [modal,setModal]=useState(false);
  const [perfil,setPerfil]=useState(null);
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(false);
  const EF={nombre:"",apellido:"",dni:"",email:"",tel:"",ciudad:"",provincia:"",estado:"Al día",sueldo:"",ocupacion:"",empresa:"",estadoCivil:"Soltero/a",nacimiento:"",score:75,notas:""};
  const [form,setForm]=useState(EF);
  const filtered=clients.filter(c=>{const q=search.toLowerCase();return(c.nombre.toLowerCase().includes(q)||c.apellido.toLowerCase().includes(q)||(c.dni||"").includes(q))&&(filtro==="Todos"||c.estado===filtro);});
  const openEdit=(c,e)=>{if(e)e.stopPropagation();setSel(c);setForm({...EF,...c});setModal(true);};

  const save=async()=>{
    if(!form.nombre||!form.dni)return;
    setLoading(true);
    const data={nombre:form.nombre,apellido:form.apellido,dni:form.dni,email:form.email,tel:form.tel,ciudad:form.ciudad,provincia:form.provincia,estado:form.estado,score:+form.score||75,sueldo:+form.sueldo||null,ocupacion:form.ocupacion,empresa:form.empresa,estado_civil:form.estadoCivil,nacimiento:form.nacimiento,notas:form.notas};
    if(sel){
      const {data:updated}=await sb.from("clientes").update(data).eq("id",sel.id).select().single();
      if(updated)setClients(cs=>cs.map(c=>c.id===sel.id?clientFromDB(updated):c));
    } else {
      const {data:created}=await sb.from("clientes").insert(data).select().single();
      if(created)setClients(cs=>[...cs,clientFromDB(created)]);
    }
    setLoading(false);setModal(false);
  };

  const del=async(id,e)=>{
    e.stopPropagation();
    if(confirm("¿Eliminar cliente?")) {
      await sb.from("clientes").delete().eq("id",id);
      setClients(cs=>cs.filter(c=>c.id!==id));
    }
  };

  return(
    <div>
      {perfil&&(
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"stretch"}}>
          <div onClick={()=>setPerfil(null)} style={{flex:1,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(3px)",cursor:"pointer"}}/>
          <div style={{width:"min(680px,95vw)",background:t.bg,overflowY:"auto",boxShadow:"-8px 0 40px rgba(0,0,0,0.35)"}}>
            <PerfilCliente client={perfil} creditos={creditos} productos={productos} setCreditos={setCreditos} onClose={()=>setPerfil(null)} onEdit={c=>{setSel(c);setForm({...EF,...c});setPerfil(null);setModal(true);}} t={t}/>
          </div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Clientes</h1><p style={{color:t.sub,margin:0,fontSize:13}}>{clients.length} registrados</p></div>
        <button onClick={()=>{setSel(null);setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nuevo cliente</button>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200,position:"relative"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre, apellido o DNI..." style={{width:"100%",padding:"10px 14px 10px 40px",borderRadius:10,border:`1px solid ${t.border}`,background:t.card,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/><span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:t.sub}}><Icon name="search" size={16}/></span></div>
        {["Todos","Al día","Moroso","Atrasado","Premium","Restringido"].map(f=><button key={f} onClick={()=>setFiltro(f)} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${filtro===f?t.accent:t.border}`,background:filtro===f?t.accent:"transparent",color:filtro===f?"#fff":t.sub,fontWeight:600,fontSize:12,cursor:"pointer"}}>{f}</button>)}
      </div>
      {clients.length===0?(
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"60px",textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:12}}>👥</div>
          <div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No hay clientes todavía</div>
          <div style={{fontSize:13,color:t.sub,marginBottom:20}}>Agregá tu primer cliente para empezar</div>
          <button onClick={()=>{setSel(null);setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer"}}>+ Agregar cliente</button>
        </div>
      ):(
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{background:t.bg}}>{["Cliente","DNI","Teléfono","Ciudad","Score","Estado","Acciones"].map(h=><th key={h} style={{padding:"11px 15px",textAlign:"left",fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(c=>(
              <tr key={c.id} style={{borderTop:`1px solid ${t.border}`,cursor:"pointer",transition:"background 0.15s"}} onClick={()=>setPerfil(c)} onMouseEnter={e=>e.currentTarget.style.background=t.bg} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <td style={{padding:"12px 15px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:36,height:36,borderRadius:"50%",background:`hsl(${(c.id*67)%360},55%,55%)`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,flexShrink:0}}>{(c.nombre||"?")[0]}{(c.apellido||"?")[0]}</div><div><div style={{fontWeight:600,color:t.text,fontSize:14}}>{c.nombre} {c.apellido}</div><div style={{fontSize:11,color:t.sub}}>{c.email}</div></div></div></td>
                <td style={{padding:"12px 15px",color:t.sub,fontSize:13}}>{c.dni}</td>
                <td style={{padding:"12px 15px"}}><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:t.sub,fontSize:13}}>{c.tel}</span>{c.tel&&<a href={`https://wa.me/54${c.tel.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{color:"#25D366",display:"flex"}}><Icon name="whatsapp" size={15}/></a>}</div></td>
                <td style={{padding:"12px 15px",color:t.sub,fontSize:13}}>{c.ciudad}</td>
                <td style={{padding:"12px 15px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:50,height:6,borderRadius:3,background:t.border,overflow:"hidden"}}><div style={{width:`${c.score||75}%`,height:"100%",background:c.score>70?"#10b981":c.score>40?"#f59e0b":"#ef4444",borderRadius:3}}/></div><span style={{fontSize:12,fontWeight:700,color:t.text}}>{c.score||75}</span></div></td>
                <td style={{padding:"12px 15px"}}><Badge status={c.estado}/></td>
                <td style={{padding:"12px 15px"}}><div style={{display:"flex",gap:6}}><button onClick={e=>openEdit(c,e)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:t.sub}}><Icon name="edit" size={14}/></button><button onClick={e=>{e.stopPropagation();generatePDFCliente(c,creditos,productos);}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#3b82f6"}} title="Exportar PDF del cliente"><Icon name="pdf" size={14}/></button><button onClick={e=>del(c.id,e)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#ef4444"}}><Icon name="trash" size={14}/></button></div></td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:t.sub}}>No se encontraron clientes</div>}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title={sel?"Editar cliente":"Nuevo cliente"} t={t} wide>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Nombre *" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))} t={t}/>
          <Field label="Apellido *" value={form.apellido} onChange={v=>setForm(f=>({...f,apellido:v}))} t={t}/>
          <Field label="DNI *" value={form.dni} onChange={v=>setForm(f=>({...f,dni:v}))} t={t}/>
          <Field label="Teléfono (sin 0 ni 15)" value={form.tel} onChange={v=>setForm(f=>({...f,tel:v}))} placeholder="Ej: 3511234567" t={t}/>
          <Field label="Email" value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} type="email" t={t}/>
          <Field label="Nacimiento" value={form.nacimiento} onChange={v=>setForm(f=>({...f,nacimiento:v}))} type="date" t={t}/>
          <Field label="Ciudad" value={form.ciudad} onChange={v=>setForm(f=>({...f,ciudad:v}))} t={t}/>
          <Field label="Provincia" value={form.provincia} onChange={v=>setForm(f=>({...f,provincia:v}))} t={t}/>
          <Field label="Ocupación" value={form.ocupacion} onChange={v=>setForm(f=>({...f,ocupacion:v}))} t={t}/>
          <Field label="Empresa" value={form.empresa} onChange={v=>setForm(f=>({...f,empresa:v}))} t={t}/>
          <Field label="Sueldo ($)" value={form.sueldo} onChange={v=>setForm(f=>({...f,sueldo:v}))} type="number" t={t}/>
          <Field label="Estado civil" value={form.estadoCivil} onChange={v=>setForm(f=>({...f,estadoCivil:v}))} options={["Soltero/a","Casado/a","Divorciado/a","Viudo/a"]} t={t}/>
          <Field label="Estado" value={form.estado} onChange={v=>setForm(f=>({...f,estado:v}))} options={["Al día","Moroso","Atrasado","Premium","Restringido"]} t={t}/>
          <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase"}}>Score ({form.score})</label><input type="range" min={0} max={100} value={form.score} onChange={e=>setForm(f=>({...f,score:+e.target.value}))} style={{width:"100%"}}/></div>
          <div style={{gridColumn:"1/-1",marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase"}}>Notas internas</label><textarea value={form.notas} onChange={e=>setForm(f=>({...f,notas:e.target.value}))} rows={3} style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box",resize:"vertical"}}/></div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Guardar"}</button>
        </div>
      </Modal>
    </div>
  );
};

// ── CRÉDITOS ──────────────────────────────────────────────────────────────────
const Creditos=({creditos,setCreditos,clients,t})=>{
  const [search,setSearch]=useState("");
  const [filtroEst,setFiltroEst]=useState("Todos");
  const [modal,setModal]=useState(false);
  const [expandido,setExpandido]=useState(null);
  const [loading,setLoading]=useState(false);
  const EF={clienteId:"",monto:"",totalCobrar:"",cuotas:"",frecuencia:"Mensual",fechaOtorg:new Date().toISOString().slice(0,10),estado:"Al día",comentarios:""};
  const [form,setForm]=useState(EF);
  const filtered=creditos.filter(c=>{const q=search.toLowerCase();return(c.clienteNombre.toLowerCase().includes(q)||c.estado.toLowerCase().includes(q))&&(filtroEst==="Todos"||c.estado===filtroEst);});
  const vc=form.cuotas&&form.totalCobrar?Math.round(+form.totalCobrar/+form.cuotas):0;
  const gan=form.monto&&form.totalCobrar?+form.totalCobrar-+form.monto:0;
  const prox=generarFechasCuotas(form.fechaOtorg,form.frecuencia,1)[0]||"";

  const save=async()=>{
    if(!form.clienteId||!form.monto||!form.totalCobrar||!form.cuotas)return;
    const client=clients.find(c=>c.id===+form.clienteId);if(!client)return;
    setLoading(true);
    const v=Math.round(+form.totalCobrar/+form.cuotas);
    const det=crearDetalleCuotas(form.fechaOtorg,form.frecuencia,+form.cuotas,v);
    const data={cliente_id:+form.clienteId,cliente_nombre:`${client.nombre} ${client.apellido}`,monto:+form.monto,total_cobrar:+form.totalCobrar,ganancia:+form.totalCobrar-+form.monto,cuotas:+form.cuotas,cuotas_pagadas:0,valor_cuota:v,saldo_cobrado:0,saldo_pendiente:+form.totalCobrar,frecuencia:form.frecuencia,fecha_otorg:form.fechaOtorg,proximo_pago:det[0]?.fechaVenc||"",estado:form.estado,comentarios:form.comentarios,historial:[],detalle_cuotas:det};
    const {data:created}=await sb.from("creditos").insert(data).select().single();
    if(created)setCreditos(cs=>[...cs,creditoFromDB(created)]);
    setLoading(false);setModal(false);
  };

  const actualizarCredito=async(cred)=>{
    await sb.from("creditos").update({cuotas_pagadas:cred.cuotasPagadas,saldo_cobrado:cred.saldoCobrado,saldo_pendiente:cred.saldoPendiente,proximo_pago:cred.proximoPago,estado:cred.estado,historial:cred.historial,detalle_cuotas:cred.detalleCuotas}).eq("id",cred.id);
    setCreditos(cs=>cs.map(c=>c.id===cred.id?cred:c));
  };

  const eliminar=async(id)=>{
    if(confirm("¿Eliminar este crédito?")){
      await sb.from("creditos").delete().eq("id",id);
      setCreditos(cs=>cs.filter(c=>c.id!==id));
    }
  };

  const clienteOpts=[{value:"",label:"— Seleccionar cliente —"},...clients.map(c=>({value:c.id,label:`${c.nombre} ${c.apellido} — DNI ${c.dni}`}))];

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Créditos & Préstamos</h1><p style={{color:t.sub,margin:0,fontSize:13}}>{creditos.filter(c=>c.estado!=="Finalizado").length} activos · {creditos.length} totales</p></div>
        <button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nuevo crédito</button>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:200,position:"relative"}}><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..." style={{width:"100%",padding:"10px 14px 10px 40px",borderRadius:10,border:`1px solid ${t.border}`,background:t.card,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/><span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:t.sub}}><Icon name="search" size={16}/></span></div>
        {["Todos","Al día","Atrasado","Moroso","Finalizado"].map(f=><button key={f} onClick={()=>setFiltroEst(f)} style={{padding:"8px 13px",borderRadius:8,border:`1px solid ${filtroEst===f?t.accent:t.border}`,background:filtroEst===f?t.accent:"transparent",color:filtroEst===f?"#fff":t.sub,fontWeight:600,fontSize:12,cursor:"pointer"}}>{f}</button>)}
      </div>
      {creditos.length===0?<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"60px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>💳</div><div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No hay créditos todavía</div><button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",marginTop:10}}>+ Nuevo crédito</button></div>:(
        <div style={{display:"grid",gap:14}}>
          {filtered.map(c=>{
            const pct=Math.round((c.cuotasPagadas/c.cuotas)*100);
            const exp=expandido===c.id;
            return(
              <div key={c.id} style={{background:t.card,borderRadius:14,border:`1px solid ${c.estado==="Moroso"?"#fca5a5":c.estado==="Atrasado"?"#fcd34d":t.border}`,overflow:"hidden"}}>
                <div style={{padding:"18px 22px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                    <div style={{flex:1,minWidth:200}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                        <span style={{fontSize:15,fontWeight:700,color:t.text}}>{c.clienteNombre}</span>
                        <Badge status={c.estado}/>
                        <span style={{fontSize:11,color:t.sub,background:t.bg,padding:"2px 8px",borderRadius:6,fontWeight:600}}>{c.frecuencia}</span>
                      </div>
                      <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                        <span style={{fontSize:12,color:t.sub}}>Capital: <strong style={{color:t.text}}>{fmt(c.monto)}</strong></span>
                        <span style={{fontSize:12,color:t.sub}}>Cobrado: <strong style={{color:t.accent2}}>{fmt(c.saldoCobrado)}</strong></span>
                        <span style={{fontSize:12,color:t.sub}}>Pendiente: <strong style={{color:"#ef4444"}}>{fmt(c.saldoPendiente)}</strong></span>
                        <span style={{fontSize:12,color:t.sub}}>Cuota: <strong style={{color:t.text}}>{fmt(c.valorCuota)}</strong></span>
                        <span style={{fontSize:12,color:t.sub}}>Próx.: <strong style={{color:t.text}}>{fmtFecha(c.proximoPago)}</strong></span>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                      <button onClick={()=>setExpandido(exp?null:c.id)} style={{background:exp?t.accent:"none",border:`1px solid ${t.accent}`,color:exp?"#fff":t.accent,borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Icon name="calendar" size={13}/>{exp?"Ocultar":"Ver cuotas"}</button>
                      <button onClick={()=>generatePDF(c)} style={{background:"none",border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Icon name="pdf" size={13}/></button>
                      <button onClick={()=>eliminar(c.id)} style={{background:"none",border:"1px solid #fca5a5",color:"#ef4444",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>
                    </div>
                  </div>
                  <div style={{marginTop:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:t.sub}}>{c.cuotasPagadas}/{c.cuotas} cuotas</span><span style={{fontSize:11,fontWeight:700,color:t.text}}>{pct}%</span></div>
                    <div style={{height:7,borderRadius:4,background:t.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct>=100?t.accent2:pct>50?t.accent:"#f59e0b",borderRadius:4,transition:"width 0.5s"}}/></div>
                  </div>
                </div>
                {exp&&<div style={{borderTop:`1px solid ${t.border}`,padding:"16px 22px",background:t.bg}}>
                  <div style={{fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",marginBottom:10}}>Cronograma — click en ✏️ para editar fecha o pago</div>
                  {(!c.detalleCuotas||c.detalleCuotas.length===0)?(
                    <div style={{textAlign:"center",padding:"20px"}}>
                      <div style={{fontSize:13,color:t.sub,marginBottom:12}}>Este crédito no tiene cuotas generadas todavía.</div>
                      <button onClick={async()=>{
                        const det=crearDetalleCuotas(c.fechaOtorg,c.frecuencia,c.cuotas,c.valorCuota);
                        await sb.from("creditos").update({detalle_cuotas:det}).eq("id",c.id);
                        actualizarCredito({...c,detalleCuotas:det});
                      }} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer"}}>
                        ✨ Generar cuotas automáticamente
                      </button>
                    </div>
                  ):(
                    <TablaCuotas credito={c} onActualizar={actualizarCredito} t={t}/>
                  )}
                </div>}
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo crédito" t={t}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1"}}><Field label="Cliente *" value={form.clienteId} onChange={v=>setForm(f=>({...f,clienteId:v}))} options={clienteOpts} t={t}/></div>
          <Field label="Monto prestado ($) *" value={form.monto} onChange={v=>setForm(f=>({...f,monto:v}))} type="number" t={t}/>
          <Field label="Total a cobrar ($) *" value={form.totalCobrar} onChange={v=>setForm(f=>({...f,totalCobrar:v}))} type="number" t={t}/>
          <Field label="Cantidad de cuotas *" value={form.cuotas} onChange={v=>setForm(f=>({...f,cuotas:v}))} type="number" t={t}/>
          <Field label="Frecuencia" value={form.frecuencia} onChange={v=>setForm(f=>({...f,frecuencia:v}))} options={FRECUENCIAS} t={t}/>
          <Field label="Fecha otorgamiento" value={form.fechaOtorg} onChange={v=>setForm(f=>({...f,fechaOtorg:v}))} type="date" t={t}/>
          <Field label="Estado" value={form.estado} onChange={v=>setForm(f=>({...f,estado:v}))} options={["Al día","Pendiente","Atrasado","Moroso"]} t={t}/>
        </div>
        {form.monto&&form.totalCobrar&&form.cuotas&&<div style={{background:t.bg,borderRadius:10,padding:"14px 16px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Valor cuota</div><div style={{fontSize:16,fontWeight:800,color:t.accent}}>{fmt(vc)}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Ganancia</div><div style={{fontSize:16,fontWeight:800,color:t.accent2}}>{fmt(gan)}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>1° vencimiento</div><div style={{fontSize:13,fontWeight:700,color:t.text}}>{fmtFecha(prox)}</div></div>
        </div>}
        <Field label="Comentarios" value={form.comentarios} onChange={v=>setForm(f=>({...f,comentarios:v}))} t={t}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Crear crédito"}</button>
        </div>
      </Modal>
    </div>
  );
};

// ── PRODUCTOS ─────────────────────────────────────────────────────────────────
const Productos=({productos,setProductos,clients,t})=>{
  const [modal,setModal]=useState(false);
  const [loading,setLoading]=useState(false);
  const EF={clienteId:"",producto:"",inversion:"",precioFinanciado:"",cuotas:"",frecuencia:"Mensual",estado:"Activo"};
  const [form,setForm]=useState(EF);
  const clienteOpts=[{value:"",label:"— Seleccionar cliente —"},...clients.map(c=>({value:c.id,label:`${c.nombre} ${c.apellido}`}))];

  const save=async()=>{
    if(!form.clienteId||!form.producto||!form.inversion||!form.cuotas)return;
    const client=clients.find(c=>c.id===+form.clienteId);
    setLoading(true);
    const vc=Math.round(+form.precioFinanciado/+form.cuotas);
    const data={cliente_id:+form.clienteId,cliente_nombre:`${client.nombre} ${client.apellido}`,producto:form.producto,inversion:+form.inversion,precio_financiado:+form.precioFinanciado,ganancia:+form.precioFinanciado-+form.inversion,cuotas:+form.cuotas,cuotas_pagadas:0,saldo_cobrado:0,valor_cuota:vc,estado:form.estado,frecuencia:form.frecuencia};
    const {data:created}=await sb.from("productos").insert(data).select().single();
    if(created)setProductos(ps=>[...ps,productoFromDB(created)]);
    setLoading(false);setModal(false);
  };

  const del=async(id)=>{
    if(confirm("¿Eliminar esta venta?")){
      await sb.from("productos").delete().eq("id",id);
      setProductos(ps=>ps.filter(p=>p.id!==id));
    }
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Venta Financiada</h1><p style={{color:t.sub,margin:0,fontSize:13}}>{productos.filter(p=>p.estado==="Activo").length} activos</p></div>
        <button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nueva venta</button>
      </div>
      {productos.length===0?<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"60px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🛒</div><div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No hay ventas todavía</div><button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",marginTop:10}}>+ Nueva venta</button></div>:(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
          {productos.map(p=>{
            const restantes=p.cuotas-p.cuotasPagadas;
            const saldo=restantes*(p.valorCuota||Math.round(p.precioFinanciado/p.cuotas));
            const pct=Math.round((p.cuotasPagadas/p.cuotas)*100);
            const rent=p.inversion>0?Math.round((p.ganancia/p.inversion)*100):0;
            return(
              <div key={p.id} style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                  <div><div style={{fontWeight:700,fontSize:15,color:t.text}}>{p.producto}</div><div style={{fontSize:12,color:t.sub}}>{p.clienteNombre} · <span style={{fontWeight:600,color:t.accent}}>{p.frecuencia}</span></div></div>
                  <div style={{display:"flex",gap:6,alignItems:"flex-start"}}><Badge status={p.estado}/><button onClick={()=>del(p.id)} style={{background:"none",border:"1px solid #fca5a5",borderRadius:6,padding:"4px 6px",cursor:"pointer",color:"#ef4444"}}><Icon name="trash" size={13}/></button></div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <div style={{background:t.bg,borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:600}}>Inversión</div><div style={{fontSize:14,fontWeight:700,color:t.text}}>{fmt(p.inversion)}</div></div>
                  <div style={{background:t.bg,borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:600}}>Financiado</div><div style={{fontSize:14,fontWeight:700,color:t.text}}>{fmt(p.precioFinanciado)}</div></div>
                  <div style={{background:t.bg,borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:600}}>Ganancia</div><div style={{fontSize:14,fontWeight:700,color:t.accent2}}>{fmt(p.ganancia)}</div></div>
                  <div style={{background:t.bg,borderRadius:8,padding:"8px 12px"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:600}}>Pendiente</div><div style={{fontSize:14,fontWeight:700,color:"#ef4444"}}>{fmt(saldo)}</div></div>
                </div>
                <div style={{fontSize:12,color:t.sub,marginBottom:8}}>{p.cuotasPagadas}/{p.cuotas} cuotas · Rentab.: <strong style={{color:"#8b5cf6"}}>{rent}%</strong></div>
                <div style={{height:6,borderRadius:3,background:t.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct>=100?t.accent2:t.accent,borderRadius:3}}/></div>
                <div style={{marginTop:4,textAlign:"right",fontSize:11,color:t.sub}}>{pct}%</div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nueva venta financiada" t={t}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1"}}><Field label="Cliente *" value={form.clienteId} onChange={v=>setForm(f=>({...f,clienteId:v}))} options={clienteOpts} t={t}/></div>
          <div style={{gridColumn:"1/-1"}}><Field label="Producto *" value={form.producto} onChange={v=>setForm(f=>({...f,producto:v}))} t={t}/></div>
          <Field label="Inversión propia ($) *" value={form.inversion} onChange={v=>setForm(f=>({...f,inversion:v}))} type="number" t={t}/>
          <Field label="Precio financiado ($)" value={form.precioFinanciado} onChange={v=>setForm(f=>({...f,precioFinanciado:v}))} type="number" t={t}/>
          <Field label="Cuotas *" value={form.cuotas} onChange={v=>setForm(f=>({...f,cuotas:v}))} type="number" t={t}/>
          <Field label="Frecuencia" value={form.frecuencia} onChange={v=>setForm(f=>({...f,frecuencia:v}))} options={FRECUENCIAS} t={t}/>
          <Field label="Estado" value={form.estado} onChange={v=>setForm(f=>({...f,estado:v}))} options={["Activo","Finalizado","Atrasado"]} t={t}/>
        </div>
        {form.inversion&&form.precioFinanciado&&<div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:12,display:"flex",gap:20}}>
          <span>Ganancia: <strong style={{color:t.accent2}}>{fmt(+form.precioFinanciado-+form.inversion)}</strong></span>
          <span>Rentabilidad: <strong style={{color:"#8b5cf6"}}>{Math.round(((+form.precioFinanciado-+form.inversion)/(+form.inversion||1))*100)}%</strong></span>
          {form.cuotas&&<span>Cuota: <strong style={{color:t.accent}}>{fmt(Math.round(+form.precioFinanciado/+form.cuotas))}</strong></span>}
        </div>}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Crear venta"}</button>
        </div>
      </Modal>
    </div>
  );
};

// ── CARTERA ───────────────────────────────────────────────────────────────────
const Cartera=({creditos,productos,clients,t})=>{
  const creditosActivos=creditos.filter(c=>c.estado!=="Finalizado");
  const plata=creditosActivos.reduce((s,c)=>s+(c.monto-c.monto*(c.cuotasPagadas/c.cuotas)),0);
  const totalCobrar=creditosActivos.reduce((s,c)=>s+c.saldoPendiente,0);
  const ganEsp=creditos.reduce((s,c)=>s+c.ganancia,0);
  const ganReal=creditos.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0);
  const moraTotal=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado").reduce((s,c)=>s+c.saldoPendiente,0);
  const totalInv=creditos.reduce((s,c)=>s+c.monto,0)+productos.reduce((s,p)=>s+p.inversion,0);
  const rend=totalInv>0?((ganEsp/totalInv)*100).toFixed(1):0;
  const morosos=clients.filter(c=>c.estado==="Moroso");
  return(
    <div>
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Panel de Cartera</h1></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:14,marginBottom:24}}>
        <MetricCard label="Plata en la calle" value={fmt(plata)} icon="coin" color="#3b82f6" sub="Capital no recuperado" t={t}/>
        <MetricCard label="Por cobrar" value={fmt(totalCobrar)} icon="cartera" color="#10b981" t={t}/>
        <MetricCard label="Total invertido" value={fmt(totalInv)} icon="check" color="#8b5cf6" t={t}/>
        <MetricCard label="Ganancia esperada" value={fmt(ganEsp)} icon="creditos" color="#f59e0b" t={t}/>
        <MetricCard label="Ganancia realizada" value={fmt(ganReal)} icon="check" color="#10b981" t={t}/>
        <MetricCard label="Mora total" value={fmt(moraTotal)} icon="alert" color="#ef4444" t={t}/>
        <MetricCard label="Rendimiento" value={`${rend}%`} icon="coin" color="#8b5cf6" sub="Sobre capital" t={t}/>
      </div>
      {morosos.length>0&&<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 22px",marginBottom:18}}>
        <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:"#ef4444"}}>Clientes morosos</h3>
        {morosos.map(m=>{
          const deuda=creditos.filter(c=>c.clienteId===m.id&&c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0);
          return(<div key={m.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:t.bg,borderRadius:10,border:"1px solid #fca5a5",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:"#fee2e2",display:"flex",alignItems:"center",justifyContent:"center",color:"#ef4444",fontWeight:700}}>{m.nombre[0]}{m.apellido[0]}</div>
              <div><div style={{fontWeight:600,color:t.text}}>{m.nombre} {m.apellido}</div>
                <a href={`https://wa.me/54${(m.tel||"").replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{fontSize:12,color:"#25D366",display:"flex",alignItems:"center",gap:4,textDecoration:"none"}}><Icon name="whatsapp" size={13}/>WhatsApp</a>
              </div>
            </div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:800,color:"#ef4444",fontSize:15}}>{fmt(deuda)}</div><div style={{fontSize:11,color:t.sub}}>adeudo</div></div>
          </div>);
        })}
      </div>}
      <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 22px"}}>
        <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:t.text}}>Todos los créditos</h3>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:t.bg}}>{["Cliente","Capital","Cobrado","Pendiente","Cuotas","Frecuencia","Estado"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
            <tbody>{creditos.map(c=>(<tr key={c.id} style={{borderTop:`1px solid ${t.border}`}}>
              <td style={{padding:"10px 14px",color:t.text,fontWeight:600}}>{c.clienteNombre}</td>
              <td style={{padding:"10px 14px",color:t.text}}>{fmt(c.monto)}</td>
              <td style={{padding:"10px 14px",color:t.accent2,fontWeight:700}}>{fmt(c.saldoCobrado)}</td>
              <td style={{padding:"10px 14px",color:"#ef4444",fontWeight:700}}>{fmt(c.saldoPendiente)}</td>
              <td style={{padding:"10px 14px",color:t.sub}}>{c.cuotasPagadas}/{c.cuotas}</td>
              <td style={{padding:"10px 14px",color:t.sub}}>{c.frecuencia}</td>
              <td style={{padding:"10px 14px"}}><Badge status={c.estado}/></td>
            </tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ── ALERTAS ───────────────────────────────────────────────────────────────────
const Alertas=({creditos,clients,t})=>{
  const morosos=creditos.filter(c=>c.estado==="Moroso");
  const atrasados=creditos.filter(c=>c.estado==="Atrasado");
  const alDia=creditos.filter(c=>c.estado==="Al día"&&c.cuotasPagadas<c.cuotas);
  const getTel=(nombre)=>{const c=clients.find(cl=>`${cl.nombre} ${cl.apellido}`===nombre);return c?.tel||"";};
  const Item=({color,icon,titulo,l1,l2,tel})=>(
    <div style={{display:"flex",gap:14,padding:"14px 18px",borderRadius:12,border:`1px solid ${color}30`,background:`${color}08`,marginBottom:10}}>
      <div style={{width:38,height:38,borderRadius:10,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",color,flexShrink:0}}><Icon name={icon} size={18}/></div>
      <div style={{flex:1}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{fontWeight:700,color:t.text,fontSize:14}}>{titulo}</div>
          {tel&&<a href={`https://wa.me/54${tel.replace(/\D/g,"")}`} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:6,background:"#25D366",color:"#fff",borderRadius:8,padding:"5px 10px",fontSize:11,fontWeight:700,textDecoration:"none"}}><Icon name="whatsapp" size={13}/>WhatsApp</a>}
        </div>
        <div style={{fontSize:12,color:t.sub}}>{l1}</div>
        {l2&&<div style={{fontSize:12,color,fontWeight:600,marginTop:2}}>{l2}</div>}
      </div>
    </div>
  );
  return(
    <div>
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Alertas</h1><p style={{color:t.sub,margin:0,fontSize:13}}>{morosos.length+atrasados.length} alertas críticas</p></div>
      {morosos.length>0&&<div style={{marginBottom:20}}><h3 style={{fontSize:13,fontWeight:700,color:"#ef4444",marginBottom:10}}>MOROSOS ({morosos.length})</h3>{morosos.map(c=><Item key={c.id} color="#ef4444" icon="alert" titulo={c.clienteNombre} l1={`${c.frecuencia} · Próx.: ${fmtFecha(c.proximoPago)}`} l2={`Saldo: ${fmt(c.saldoPendiente)}`} tel={getTel(c.clienteNombre)}/>)}</div>}
      {atrasados.length>0&&<div style={{marginBottom:20}}><h3 style={{fontSize:13,fontWeight:700,color:"#f59e0b",marginBottom:10}}>ATRASADOS ({atrasados.length})</h3>{atrasados.map(c=><Item key={c.id} color="#f59e0b" icon="alert" titulo={c.clienteNombre} l1={`${c.frecuencia} · Próx.: ${fmtFecha(c.proximoPago)}`} l2={`Saldo: ${fmt(c.saldoPendiente)}`} tel={getTel(c.clienteNombre)}/>)}</div>}
      {alDia.length>0&&<div><h3 style={{fontSize:13,fontWeight:700,color:"#3b82f6",marginBottom:10}}>PRÓXIMOS VENCIMIENTOS ({alDia.length})</h3>{alDia.map(c=><Item key={c.id} color="#3b82f6" icon="calendar" titulo={c.clienteNombre} l1={`${c.frecuencia} · Próx.: ${fmtFecha(c.proximoPago)}`} l2={`Cuota: ${fmt(c.valorCuota)}`} tel={getTel(c.clienteNombre)}/>)}</div>}
      {morosos.length===0&&atrasados.length===0&&creditos.length===0&&<div style={{textAlign:"center",padding:"60px 0",color:t.sub}}><div style={{fontSize:48,marginBottom:12}}>✅</div><div style={{fontSize:16,fontWeight:700,color:t.text}}>Sin alertas</div></div>}
    </div>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App(){
  const [dark,setDark]=useState(true);
  const [screen,setScreen]=useState("dashboard");
  const [allClients,setAllClients]=useState([]);
  const [allCreditos,setAllCreditos]=useState([]);
  const [allProductos,setAllProductos]=useState([]);
  const [sideOpen,setSideOpen]=useState(true);
  const [loggedIn,setLoggedIn]=useState(false);
  const [usuarioActual,setUsuarioActual]=useState(null);
  const [loginForm,setLoginForm]=useState({user:"",pass:""});
  const [loginErr,setLoginErr]=useState("");
  const [loadingData,setLoadingData]=useState(false);
  const t=dark?DARK:LIGHT;

  const esAdmin=usuarioActual?.rol==="admin"||usuarioActual?.user==="andres";
  const clients=esAdmin?allClients:allClients.filter(c=>!c.usuarioId||c.usuarioId===usuarioActual?.id);
  const creditos=esAdmin?allCreditos:allCreditos.filter(c=>!c.usuarioId||c.usuarioId===usuarioActual?.id);
  const productos=esAdmin?allProductos:allProductos.filter(p=>!p.usuarioId||p.usuarioId===usuarioActual?.id);
  const setClients=(fn)=>setAllClients(fn);
  const setCreditos=(fn)=>setAllCreditos(fn);
  const setProductos=(fn)=>setAllProductos(fn);

  const cargarDatos=async()=>{
    setLoadingData(true);
    const [{data:cls},{data:crs},{data:prds}]=await Promise.all([
      sb.from("clientes").select("*").order("id"),
      sb.from("creditos").select("*").order("id"),
      sb.from("productos").select("*").order("id"),
    ]);
    if(cls)setAllClients(cls.map(clientFromDB));
    if(crs)setAllCreditos(crs.map(creditoFromDB));
    if(prds)setAllProductos(prds.map(productoFromDB));
    setLoadingData(false);
  };

  const doLogin=async()=>{
    if(!loginForm.user||!loginForm.pass){setLoginErr("Completá usuario y contraseña");return;}
    if(loginForm.user==="andres"&&loginForm.pass==="Laliga2215"){
      setUsuarioActual({id:0,nombre:"Andres",user:"andres",rol:"admin"});
      setLoggedIn(true);setLoginErr("");cargarDatos();return;
    }
    const {data}=await sb.from("usuarios").select("*").eq("user_name",loginForm.user).eq("password",loginForm.pass).eq("activo",true).single();
    if(data){setUsuarioActual(usuarioFromDB(data));setLoggedIn(true);setLoginErr("");cargarDatos();}
    else setLoginErr("Usuario o contraseña incorrectos");
  };

  if(!loggedIn)return(
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif"}}>
      <div style={{background:t.card,borderRadius:20,padding:"40px 44px",width:360,boxShadow:"0 32px 80px rgba(0,0,0,0.3)",border:`1px solid ${t.border}`}}>
        <div style={{textAlign:"center",marginBottom:32}}><div style={{fontSize:30,fontWeight:900,color:t.accent,letterSpacing:"-2px",marginBottom:4}}>Control<span style={{color:t.text}}>Credit</span></div><div style={{fontSize:13,color:t.sub}}>Sistema de Gestión Financiera</div></div>
        <div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase"}}>Usuario</label><input value={loginForm.user} onChange={e=>setLoginForm(f=>({...f,user:e.target.value}))} placeholder="Tu usuario" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></div>
        <div style={{marginBottom:20}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase"}}>Contraseña</label><input type="password" value={loginForm.pass} onChange={e=>setLoginForm(f=>({...f,pass:e.target.value}))} placeholder="Tu contraseña" style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></div>
        {loginErr&&<div style={{color:"#ef4444",fontSize:12,marginBottom:12,textAlign:"center"}}>{loginErr}</div>}
        <button onClick={doLogin} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:t.accent,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>Ingresar</button>
      </div>
    </div>
  );

  if(loadingData)return(
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:t.sub}}><div style={{fontSize:36,marginBottom:12}}>⏳</div><div style={{fontSize:15,fontWeight:700,color:t.text}}>Cargando datos...</div></div>
    </div>
  );

  const NAV=[
    {id:"dashboard",label:"Dashboard",icon:"dashboard"},
    {id:"clientes",label:"Clientes",icon:"users"},
    {id:"creditos",label:"Créditos",icon:"creditos"},
    {id:"productos",label:"Productos",icon:"productos"},
    {id:"cartera",label:"Cartera",icon:"cartera"},
    {id:"alertas",label:"Alertas",icon:"alert"},
    ...(esAdmin?[{id:"usuarios",label:"Usuarios",icon:"users"}]:[]),
  ];
  const alertCount=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado").length;

  return(
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",background:t.bg,color:t.text}}>
      <div style={{width:sideOpen?220:64,background:t.sidebar,display:"flex",flexDirection:"column",transition:"width 0.2s",flexShrink:0,position:"sticky",top:0,height:"100vh",overflow:"hidden"}}>
        <div style={{padding:"20px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid #ffffff10"}}>
          <div style={{width:34,height:34,borderRadius:10,background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Icon name="coin" size={17}/></div>
          {sideOpen&&<div style={{fontSize:15,fontWeight:900,color:"#fff",whiteSpace:"nowrap"}}>Control<span style={{color:t.accent}}>Credit</span></div>}
        </div>
        {sideOpen&&usuarioActual&&<div style={{padding:"10px 16px 0",borderBottom:"1px solid #ffffff10"}}>
          <div style={{fontSize:11,color:"#64748b",marginBottom:2}}>Conectado como</div>
          <div style={{fontSize:13,fontWeight:700,color:"#fff",marginBottom:6}}>{usuarioActual.nombre}</div>
          <div style={{fontSize:10,background:esAdmin?"#4c1d95":"#1e3a8a",color:"#fff",padding:"2px 8px",borderRadius:20,display:"inline-block",marginBottom:10,fontWeight:600}}>{esAdmin?"ADMIN":"EMPLEADO"}</div>
        </div>}
        <nav style={{flex:1,padding:"12px 8px"}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setScreen(n.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",marginBottom:2,background:screen===n.id?`${t.accent}25`:"transparent",color:screen===n.id?t.accent:t.sidebarText,fontWeight:screen===n.id?700:500,fontSize:13,textAlign:"left",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(screen!==n.id)e.currentTarget.style.background=`${t.accent}12`}}
              onMouseLeave={e=>{if(screen!==n.id)e.currentTarget.style.background="transparent"}}>
              <span style={{flexShrink:0}}><Icon name={n.icon} size={18}/></span>
              {sideOpen&&<span style={{whiteSpace:"nowrap"}}>{n.label}</span>}
              {n.id==="alertas"&&alertCount>0&&<span style={{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{alertCount}</span>}
            </button>
          ))}
        </nav>
        <div style={{padding:"12px 8px",borderTop:"1px solid #ffffff10"}}>
          <button onClick={()=>setDark(d=>!d)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:t.sidebarText,fontSize:13,marginBottom:4}}><Icon name={dark?"sun":"moon"} size={18}/>{sideOpen&&<span>{dark?"Modo claro":"Modo oscuro"}</span>}</button>
          <button onClick={()=>{setLoggedIn(false);setUsuarioActual(null);setAllClients([]);setAllCreditos([]);setAllProductos([]);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:"#ef4444",fontSize:13}}><Icon name="logout" size={18}/>{sideOpen&&<span>Cerrar sesión</span>}</button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:t.card,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${t.border}`,position:"sticky",top:0,zIndex:100}}>
          <button onClick={()=>setSideOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,padding:4,borderRadius:6}}><Icon name="menu" size={20}/></button>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {alertCount>0&&<div style={{display:"flex",alignItems:"center",gap:6,background:"#fef3c7",color:"#92400e",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600}}><Icon name="alert" size={14}/>{alertCount} alertas</div>}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13}}>{(usuarioActual?.nombre||"A")[0].toUpperCase()}</div>
              {sideOpen&&<span style={{fontSize:12,color:t.sub}}>{usuarioActual?.nombre}</span>}
            </div>
          </div>
        </header>
        <main style={{flex:1,padding:"26px",overflowY:"auto"}}>
          {screen==="dashboard"&&<Dashboard clients={clients} creditos={creditos} productos={productos} t={t}/>}
          {screen==="clientes"&&<Clientes clients={clients} setClients={setClients} creditos={creditos} setCreditos={setCreditos} productos={productos} t={t}/>}
          {screen==="creditos"&&<Creditos creditos={creditos} setCreditos={setCreditos} clients={clients} t={t}/>}
          {screen==="productos"&&<Productos productos={productos} setProductos={setProductos} clients={clients} t={t}/>}
          {screen==="cartera"&&<Cartera creditos={creditos} productos={productos} clients={clients} t={t}/>}
          {screen==="alertas"&&<Alertas creditos={creditos} clients={clients} t={t}/>}
          {screen==="usuarios"&&esAdmin&&<AdminUsuarios t={t}/>}
        </main>
      </div>
    </div>
  );
}
