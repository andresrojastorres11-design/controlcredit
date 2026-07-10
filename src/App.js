// Este archivo reemplaza el contenido de src/App.js
// Supabase ya está integrado - los datos se guardan en la nube
/* eslint-disable no-restricted-globals */
/* eslint-disable no-unused-vars */
/* eslint-disable no-useless-escape */

import { useState, useEffect, useRef } from "react";
import React from "react";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { initDB, saveToLocal, getFromLocal, updateLocal, agregarACola } from "./db";
import { sincronizarCola } from "./sync";

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const LIGHT={bg:"#f4f6fb",card:"#ffffff",sidebar:"#0f1729",sidebarText:"#94a3b8",text:"#0f172a",sub:"#64748b",border:"#e2e8f0",accent:"#3b82f6",accent2:"#10b981",danger:"#ef4444",warning:"#f59e0b",purple:"#8b5cf6",input:"#ffffff",inputBorder:"#cbd5e1"};
const DARK={bg:"#0a0f1e",card:"#111827",sidebar:"#070d1a",sidebarText:"#64748b",text:"#f1f5f9",sub:"#94a3b8",border:"#1e2d45",accent:"#3b82f6",accent2:"#10b981",danger:"#ef4444",warning:"#f59e0b",purple:"#8b5cf6",input:"#0d1526",inputBorder:"#1e2d45"};

const EVOL=[{mes:"Ene",cobros:0,mora:0,prestamos:0},{mes:"Feb",cobros:0,mora:0,prestamos:0},{mes:"Mar",cobros:0,mora:0,prestamos:0},{mes:"Abr",cobros:0,mora:0,prestamos:0},{mes:"May",cobros:0,mora:0,prestamos:0},{mes:"Jun",cobros:0,mora:0,prestamos:0}];
const FRECUENCIAS=["Semanal","Quincenal","Mensual"];
const fmt=(n)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n||0);
const fmtFecha=(iso)=>{if(!iso)return"—";const[y,m,d]=iso.split("-");return`${d}/${m}/${y}`;};
const generarFechasCuotas=(fechaOtorg,frecuencia,cantCuotas)=>{
  if(!fechaOtorg||!cantCuotas)return[];
  return Array.from({length:cantCuotas},(_,i)=>{
    const d=new Date(fechaOtorg);
    if(frecuencia==="Mensual"){
      // Mismo día del mes siguiente — respeta el día exacto
      const diaOrigen=d.getDate();
      d.setMonth(d.getMonth()+(i+1));
      // Si el mes no tiene ese día (ej: 31 en febrero) usa el último día del mes
      const ultimoDia=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
      d.setDate(Math.min(diaOrigen,ultimoDia));
    } else {
      const dias=frecuencia==="Semanal"?7:14;
      d.setDate(d.getDate()+dias*(i+1));
    }
    return d.toISOString().slice(0,10);
  });
};
const crearDetalleCuotas=(fechaOtorg,frecuencia,cantCuotas,valorCuota)=>{const fechas=generarFechasCuotas(fechaOtorg,frecuencia,cantCuotas);return fechas.map((fecha,i)=>({num:i+1,fechaVenc:fecha,montoPagado:0,estado:"Pendiente",fechaPago:null}));};

// Helpers para convertir entre snake_case (Supabase) y camelCase (App)
const clientFromDB=(r)=>({id:r.id,nombre:r.nombre,apellido:r.apellido,dni:r.dni||"",email:r.email||"",tel:r.tel||"",ciudad:r.ciudad||"",provincia:r.provincia||"",estado:r.estado||"Al día",score:r.score||75,sueldo:r.sueldo||"",ocupacion:r.ocupacion||"",empresa:r.empresa||"",estadoCivil:r.estado_civil||"",nacimiento:r.nacimiento||"",notas:r.notas||"",usuarioId:r.usuario_id||0,dniFrenteUrl:r.dni_frente||"",dniDorsoUrl:r.dni_dorso||"",direccion:r.direccion||"",mapsLink:r.maps_link||""});
const creditoFromDB=(r)=>({id:r.id,clienteId:r.cliente_id,clienteNombre:r.cliente_nombre,monto:r.monto,totalCobrar:r.total_cobrar,ganancia:r.ganancia,cuotas:r.cuotas,cuotasPagadas:r.cuotas_pagadas||0,valorCuota:r.valor_cuota,saldoCobrado:r.saldo_cobrado||0,saldoPendiente:r.saldo_pendiente,frecuencia:r.frecuencia,fechaOtorg:r.fecha_otorg,proximoPago:r.proximo_pago,estado:r.estado,comentarios:r.comentarios||"",historial:r.historial||[],detalleCuotas:r.detalle_cuotas||[],usuarioId:r.usuario_id||0,pagareUrl:r.pagare_url||""});
const productoFromDB=(r)=>({id:r.id,clienteId:r.cliente_id,clienteNombre:r.cliente_nombre,producto:r.producto,inversion:r.inversion,precioFinanciado:r.precio_financiado,ganancia:r.ganancia,cuotas:r.cuotas,cuotasPagadas:r.cuotas_pagadas||0,saldoCobrado:r.saldo_cobrado||0,saldoPendiente:r.saldo_pendiente||r.precio_financiado||0,valorCuota:r.valor_cuota||Math.round((r.precio_financiado||0)/(r.cuotas||1)),estado:r.estado,frecuencia:r.frecuencia,usuarioId:r.usuario_id||0,detalleCuotas:r.detalle_cuotas||[],fechaOtorg:r.fecha_otorg||"",proximoPago:r.proximo_pago||"",entrega:r.entrega||0});

// ── PDF ENGINE ────────────────────────────────────────────────────────────────
const abrirPDF=(html,nombre)=>{
  const estiloImpresion=`<style>@media print{@page{margin:15mm;size:A4}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>`;
  const fullHtml=`<!DOCTYPE html><html><head><meta charset="UTF-8">${estiloImpresion}<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff;padding:20px}.header{background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff;padding:24px 28px;border-radius:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:26px;font-weight:900;letter-spacing:-1px}.logo span{opacity:0.7}.subtitulo{font-size:11px;opacity:0.8;margin-top:3px}.seccion{margin-bottom:18px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}.seccion-titulo{background:#f8fafc;padding:10px 16px;font-weight:700;font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid #e2e8f0}.seccion-body{padding:14px 16px}table{width:100%;border-collapse:collapse}td,th{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:11px;text-align:left}th{font-weight:700;color:#64748b;text-transform:uppercase;font-size:10px;letter-spacing:0.04em}tr:last-child td{border-bottom:none}.total-row td{background:#1e3a8a;color:#fff;font-weight:700;border:none;padding:10px 12px}.metrica{display:inline-block;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 16px;margin:4px;min-width:120px;text-align:center}.metrica-label{font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:3px}.metrica-valor{font-size:16px;font-weight:900;color:#1e40af}.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}.badge-verde{background:#d1fae5;color:#065f46}.badge-rojo{background:#fee2e2;color:#991b1b}.badge-amarillo{background:#fef3c7;color:#92400e}.footer{text-align:center;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}</style></head><body>${html}<script>window.onload=()=>{window.print();}</script></body></html>`;
  const win=window.open("","_blank");
  if(win){win.document.write(fullHtml);win.document.close();}
};

// PDF de crédito individual
const generatePDF=(credito)=>{
  const fecha=new Date().toLocaleDateString("es-AR");
  const filas=(credito.detalleCuotas||[]).map(d=>{
    const vc=d.valorCuotaEditado||credito.valorCuota||0;
    const saldoCuota=Math.max(0,vc-d.montoPagado);
    const badgeClass=d.estado==="Pagada"?"badge-verde":d.estado==="Parcial"?"badge-amarillo":"badge-rojo";
    const fechaPagoCol=d.fechaPago?`<span style="color:#10b981;font-size:10px">✓ ${d.fechaPago}</span>`:`<span style="color:#94a3b8;font-size:10px">—</span>`;
    return`<tr>
      <td style="font-weight:700">${d.num}</td>
      <td>${fmtFecha(d.fechaVenc)}</td>
      <td>${fechaPagoCol}</td>
      <td>${fmt(vc)}${d.valorCuotaEditado&&d.valorCuotaEditado!==credito.valorCuota?'<span style="font-size:9px;color:#f59e0b;margin-left:3px">+mora</span>':''}</td>
      <td style="color:#10b981;font-weight:600">${fmt(d.montoPagado)}</td>
      <td style="color:#ef4444;font-weight:600">${fmt(saldoCuota)}</td>
      <td><span class="badge ${badgeClass}">${d.estado}</span></td>
    </tr>`;
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
        <table><tr>
          <td><strong>Cliente:</strong> ${credito.clienteNombre}</td>
          <td><strong>Estado actual:</strong> ${(()=>{
            const hoy=new Date();hoy.setHours(0,0,0,0);
            const det=credito.detalleCuotas||[];
            const vencidas=det.filter(d=>(d.estado==="Pendiente"||d.estado==="Parcial")&&d.fechaVenc&&new Date(d.fechaVenc)<hoy);
            const diasMax=vencidas.length>0?Math.round((hoy-new Date(vencidas[0].fechaVenc))/(1000*60*60*24)):0;
            let estadoReal=credito.estado;
            if(credito.estado!=="Finalizado"){
              if(diasMax>15)estadoReal="Moroso";
              else if(diasMax>3)estadoReal="Atrasado";
              else if(vencidas.length===0&&credito.estado!=="Moroso"&&credito.estado!=="Atrasado")estadoReal="Al día";
            }
            const badgeColor=estadoReal==="Al día"?"badge-verde":estadoReal==="Moroso"?"badge-rojo":"badge-amarillo";
            const diasMsg=diasMax>0?` (${diasMax} día${diasMax!==1?"s":""} de atraso)`:"";
            return`<span class="badge ${badgeColor}">${estadoReal}</span><span style="font-size:10px;color:#64748b">${diasMsg}</span>`;
          })()}</td>
          <td><strong>Frecuencia:</strong> ${credito.frecuencia}</td>
          <td><strong>Fecha otorgamiento:</strong> ${fmtFecha(credito.fechaOtorg)}</td>
        </tr></table>
      </div>
    </div>
    <div class="seccion">
      <div class="seccion-titulo">Resumen financiero</div>
      <div class="seccion-body" style="text-align:center">
        <div class="metrica"><div class="metrica-label">Valor de cuota</div><div class="metrica-valor">${fmt(credito.valorCuota)}</div></div>
        ${credito.entrega>0?`<div class="metrica"><div class="metrica-label" style="color:#10b981">✓ Entrega / Adelanto</div><div class="metrica-valor" style="color:#10b981">${fmt(credito.entrega)}</div></div>`:""}
        <div class="metrica"><div class="metrica-label">Cuotas pagadas</div><div class="metrica-valor">${credito.cuotasPagadas}/${credito.cuotas}</div></div>
        <div class="metrica"><div class="metrica-label">Progreso</div><div class="metrica-valor">${pct}%</div></div>
      </div>
    </div>
    ${filas?`<div class="seccion"><div class="seccion-titulo">Detalle de cuotas</div><div class="seccion-body"><table><tr><th>#</th><th>Vencimiento</th><th>Fecha pago</th><th>Valor</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr>${filas}</table></div></div>`:""}
    <div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;font-size:11px;color:#1e40af;border-radius:0 8px 8px 0;margin-bottom:16px">
      ⚠️ Documento informativo. No implica reconocimiento de deuda. Los montos pueden estar sujetos a actualizaciones.
    </div>
    <div class="footer">ControlCredit &copy; ${new Date().getFullYear()} — Documento generado automáticamente — No válido como recibo de pago</div>
  `;
  abrirPDF(html,`Credito_${credito.clienteNombre.replace(/ /g,"_")}`);
};

// PDF de reporte mensual
const generateReporteMensual=(creditos,clientes,productos,mes,anio,ventasContado=[])=>{
  const fecha=new Date().toLocaleDateString("es-AR");
  const nombreMes=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes-1];
  const fechaDesde=`${anio}-${String(mes).padStart(2,"0")}-01`;
  const fechaHasta=`${anio}-${String(mes).padStart(2,"0")}-${new Date(anio,mes,0).getDate()}`;
  const ultimoDia=new Date(anio,mes,0).getDate();

  // ── FILTRAR POR MES ──
  const creditosMes=creditos.filter(c=>c.fechaOtorg>=fechaDesde&&c.fechaOtorg<=fechaHasta);
  const productosMes=productos.filter(p=>p.fechaOtorg&&p.fechaOtorg>=fechaDesde&&p.fechaOtorg<=fechaHasta);
  const ventasContadoMes=ventasContado.filter(v=>v.fecha&&v.fecha>=fechaDesde&&v.fecha<=fechaHasta);

  // Cobros recibidos en el mes (cuotas pagadas ese mes)
  const pagosCreditosMes=creditos.flatMap(c=>(c.historial||[]).filter(h=>
    (h.tipo==="pago_cuota"||h.tipo==="pago_completo")&&h.fecha&&(()=>{
      const p=h.fecha.split("/");if(p.length<3)return false;
      const fh=`${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
      return fh>=fechaDesde&&fh<=fechaHasta;
    })()
  ));
  const cobradoCreditosMes=pagosCreditosMes.reduce((s,h)=>s+(h.monto||0),0);
  const cobradoVentasContadoMes=ventasContadoMes.reduce((s,v)=>s+v.precio_venta,0);
  const totalCobradoMes=cobradoCreditosMes+cobradoVentasContadoMes;

  // ── MÉTRICAS GENERALES (estado actual) ──
  const creditosActivos=creditos.filter(c=>c.estado!=="Finalizado");
  const productosActivos=productos.filter(p=>p.estado!=="Finalizado");
  const totalEnLaCalle=creditosActivos.reduce((s,c)=>s+(c.monto-c.monto*(c.cuotasPagadas/c.cuotas)),0)
    +productosActivos.reduce((s,p)=>s+(p.inversion-(p.inversion*(p.cuotasPagadas/p.cuotas))),0);
  const totalPorCobrar=creditosActivos.reduce((s,c)=>s+c.saldoPendiente,0)
    +productosActivos.reduce((s,p)=>s+(p.saldoPendiente||0),0);
  const totalInvertido=creditos.reduce((s,c)=>s+c.monto,0)+productos.reduce((s,p)=>s+p.inversion,0);
  const gananciaEsperada=creditos.reduce((s,c)=>s+c.ganancia,0)+productos.reduce((s,p)=>s+p.ganancia,0);
  const gananciaRealizada=creditos.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0)
    +productos.reduce((s,p)=>s+(p.ganancia/p.cuotas)*p.cuotasPagadas,0)
    +ventasContado.reduce((s,v)=>s+v.ganancia,0);
  const moraTotal=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado").reduce((s,c)=>s+c.saldoPendiente,0);
  const rendimiento=totalInvertido>0?((gananciaEsperada/totalInvertido)*100).toFixed(1):0;
  const morosos=clientes.filter(c=>c.estado==="Moroso");

  // ── MÉTRICAS DEL MES ──
  const capitalMes=creditosMes.reduce((s,c)=>s+c.monto,0);
  const inversionProdMes=productosMes.reduce((s,p)=>s+p.inversion,0);
  const gananciaMes=creditosMes.reduce((s,c)=>s+c.ganancia,0)+productosMes.reduce((s,p)=>s+p.ganancia,0)+ventasContadoMes.reduce((s,v)=>s+v.ganancia,0);

  // ── FILAS ──
  const filasCredMes=creditosMes.map(c=>`<tr>
    <td>${c.clienteNombre}</td><td>${fmt(c.monto)}</td><td>${fmt(c.totalCobrar)}</td>
    <td style="color:#10b981;font-weight:700">${fmt(c.ganancia)}</td><td>${c.frecuencia}</td>
    <td><span class="badge ${c.estado==="Al día"?"badge-verde":c.estado==="Moroso"?"badge-rojo":"badge-amarillo"}">${c.estado}</span></td>
  </tr>`).join("");

  const filasProdMes=productosMes.map(p=>`<tr>
    <td>${p.clienteNombre}</td><td>${p.producto}</td><td>${fmt(p.inversion)}</td>
    <td>${fmt(p.precioFinanciado)}</td><td style="color:#10b981;font-weight:700">${fmt(p.ganancia)}</td>
    <td>${p.frecuencia}</td><td><span class="badge badge-verde">${p.estado}</span></td>
  </tr>`).join("");

  const filasVentasMes=ventasContadoMes.map(v=>`<tr>
    <td>${v.producto}</td><td>${v.cliente_nombre||"—"}</td><td>${fmt(v.costo)}</td>
    <td>${fmt(v.precio_venta)}</td><td style="color:#10b981;font-weight:700">${fmt(v.ganancia)}</td>
    <td>${fmtFecha(v.fecha)}</td>
  </tr>`).join("");

  const filasMorosos=morosos.map(m=>{
    const deuda=creditos.filter(c=>c.clienteId===m.id&&c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0);
    return`<tr><td>${m.nombre} ${m.apellido}</td><td>${m.tel||"—"}</td><td style="color:#ef4444;font-weight:700">${fmt(deuda)}</td></tr>`;
  }).join("");

  const html=`
    <div class="header">
      <div><div class="logo">Control<span>Credit</span></div><div class="subtitulo">Reporte Mensual — ${nombreMes} ${anio}</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700">Período del mes</div><div style="font-size:11px;opacity:0.8">01/${String(mes).padStart(2,"0")}/${anio} al ${ultimoDia}/${String(mes).padStart(2,"0")}/${anio}</div><div style="font-size:10px;opacity:0.7;margin-top:4px">Generado: ${fecha}</div></div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">📊 Estado general del negocio</div>
      <div class="seccion-body" style="text-align:center">
        <div class="metrica"><div class="metrica-label">Plata en la calle</div><div class="metrica-valor">${fmt(totalEnLaCalle)}</div></div>
        <div class="metrica"><div class="metrica-label">Por cobrar total</div><div class="metrica-valor">${fmt(totalPorCobrar)}</div></div>
        <div class="metrica"><div class="metrica-label">Total invertido</div><div class="metrica-valor">${fmt(totalInvertido)}</div></div>
        <div class="metrica"><div class="metrica-label">Ganancia esperada</div><div class="metrica-valor" style="color:#8b5cf6">${fmt(gananciaEsperada)}</div></div>
        <div class="metrica"><div class="metrica-label">Ganancia realizada</div><div class="metrica-valor" style="color:#10b981">${fmt(gananciaRealizada)}</div></div>
        <div class="metrica"><div class="metrica-label">Rendimiento</div><div class="metrica-valor" style="color:#8b5cf6">${rendimiento}%</div></div>
        <div class="metrica"><div class="metrica-label">Mora total</div><div class="metrica-valor" style="color:#ef4444">${fmt(moraTotal)}</div></div>
        <div class="metrica"><div class="metrica-label">Clientes totales</div><div class="metrica-valor">${clientes.length}</div></div>
      </div>
    </div>

    <div class="seccion">
      <div class="seccion-titulo">📅 Actividad de ${nombreMes} ${anio}</div>
      <div class="seccion-body" style="text-align:center">
        <div class="metrica"><div class="metrica-label">Créditos otorgados</div><div class="metrica-valor">${creditosMes.length}</div></div>
        <div class="metrica"><div class="metrica-label">Capital prestado</div><div class="metrica-valor">${fmt(capitalMes)}</div></div>
        <div class="metrica"><div class="metrica-label">Ventas financiadas</div><div class="metrica-valor">${productosMes.length}</div></div>
        <div class="metrica"><div class="metrica-label">Inversión en productos</div><div class="metrica-valor">${fmt(inversionProdMes)}</div></div>
        <div class="metrica"><div class="metrica-label">Ventas de contado</div><div class="metrica-valor">${ventasContadoMes.length}</div></div>
        <div class="metrica"><div class="metrica-label">Cobrado en el mes</div><div class="metrica-valor" style="color:#10b981">${fmt(totalCobradoMes)}</div></div>
        <div class="metrica"><div class="metrica-label">Ganancia del mes</div><div class="metrica-valor" style="color:#10b981">${fmt(gananciaMes)}</div></div>
        <div class="metrica"><div class="metrica-label">Morosos</div><div class="metrica-valor" style="color:#ef4444">${morosos.length}</div></div>
      </div>
    </div>

    ${creditosMes.length>0?`<div class="seccion"><div class="seccion-titulo">💳 Créditos otorgados en ${nombreMes} ${anio} (${creditosMes.length})</div><div class="seccion-body"><table><tr><th>Cliente</th><th>Capital</th><th>Total cobrar</th><th>Ganancia</th><th>Frecuencia</th><th>Estado</th></tr>${filasCredMes}</table></div></div>`:""}

    ${productosMes.length>0?`<div class="seccion"><div class="seccion-titulo">🛒 Ventas financiadas en ${nombreMes} ${anio} (${productosMes.length})</div><div class="seccion-body"><table><tr><th>Cliente</th><th>Producto</th><th>Inversión</th><th>Financiado</th><th>Ganancia</th><th>Frecuencia</th><th>Estado</th></tr>${filasProdMes}</table></div></div>`:""}

    ${ventasContadoMes.length>0?`<div class="seccion"><div class="seccion-titulo">💵 Ventas de contado en ${nombreMes} ${anio} (${ventasContadoMes.length})</div><div class="seccion-body"><table><tr><th>Producto</th><th>Cliente</th><th>Costo</th><th>Precio venta</th><th>Ganancia</th><th>Fecha</th></tr>${filasVentasMes}</table></div></div>`:""}

    ${morosos.length>0?`<div class="seccion"><div class="seccion-titulo">⚠️ Clientes morosos al cierre del mes (${morosos.length})</div><div class="seccion-body"><table><tr><th>Cliente</th><th>Teléfono</th><th>Deuda total</th></tr>${filasMorosos}</table></div></div>`:""}

    <div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:12px 16px;font-size:11px;color:#1e40af;border-radius:0 8px 8px 0;margin-bottom:16px">
      Reporte generado automáticamente por ControlCredit. Documento confidencial — uso interno.
    </div>
    <div class="footer">ControlCredit &copy; ${new Date().getFullYear()} — Reporte ${nombreMes} ${anio} — Confidencial</div>
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

// ── SUBIR ARCHIVOS A SUPABASE STORAGE ────────────────────────────────────────
const subirArchivo=async(file,carpeta)=>{
  const ext=file.name.split('.').pop();
  const nombre=`${carpeta}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const {data,error}=await sb.storage.from('documentos').upload(nombre,file,{cacheControl:'3600',upsert:false});
  if(error)throw error;
  const {data:urlData}=sb.storage.from('documentos').getPublicUrl(nombre);
  // Si el bucket es privado usamos signed URL
  const {data:signed}=await sb.storage.from('documentos').createSignedUrl(nombre,60*60*24*365);
  return signed?.signedUrl||urlData?.publicUrl||nombre;
};

// Componente de subida de foto/documento
const UploadBtn=({label,url,onUpload,accept,t,color="#3b82f6"})=>{
  const [loading,setLoading]=useState(false);
  const ref=React.useRef();
  const handleFile=async(e)=>{
    const file=e.target.files[0];
    if(!file)return;
    setLoading(true);
    try{
      const fileUrl=await subirArchivo(file,'documentos');
      onUpload(fileUrl);
    }catch(err){
      alert('Error al subir archivo: '+err.message);
    }
    setLoading(false);
    e.target.value='';
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      <button onClick={()=>ref.current.click()} disabled={loading}
        style={{display:"flex",alignItems:"center",gap:6,background:`${color}15`,border:`1px solid ${color}40`,borderRadius:8,padding:"7px 12px",cursor:"pointer",color,fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>
        {loading?'⏳ Subiendo...':`📎 ${label}`}
      </button>
      <input ref={ref} type="file" accept={accept||"image/*,.pdf"} onChange={handleFile} style={{display:"none"}}/>
      {url&&(
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{fontSize:11,color,textDecoration:"none",display:"flex",alignItems:"center",gap:4,background:`${color}10`,padding:"4px 8px",borderRadius:6,border:`1px solid ${color}20`}}>
          👁 Ver documento
        </a>
      )}
    </div>
  );
};
const exportarExcelCreditos=(creditos,clients)=>{
  const activos=creditos.filter(c=>c.estado!=="Finalizado");
  let csv="CLIENTE,DNI,TELÉFONO,ESTADO,CAPITAL,TOTAL A COBRAR,YA COBRADO,SALDO PENDIENTE,CUOTAS,CUOTAS PAGADAS,CUOTAS RESTANTES,VALOR CUOTA,FRECUENCIA,PRÓX. VENCIMIENTO,OBSERVACIONES\n";
  activos.forEach(c=>{
    const cliente=clients.find(cl=>cl.id===c.clienteId);
    const restantes=c.cuotas-c.cuotasPagadas;
    csv+=`"${c.clienteNombre}","${cliente?.dni||""}","${cliente?.tel||""}","${c.estado}","${c.monto}","${c.totalCobrar}","${c.saldoCobrado}","${c.saldoPendiente}","${c.cuotas}","${c.cuotasPagadas}","${restantes}","${c.valorCuota}","${c.frecuencia}","${fmtFecha(c.proximoPago)}","${c.comentarios||""}"\n`;
    if(c.detalleCuotas?.length>0){
      csv+=`"  Cuota #","Vencimiento","Valor","Pagado","Saldo","Estado",,,,,,,,\n`;
      c.detalleCuotas.forEach(d=>{
        const vc=d.valorCuotaEditado||c.valorCuota;
        csv+=`"  ${d.num}","${fmtFecha(d.fechaVenc)}","${vc}","${d.montoPagado}","${Math.max(0,vc-d.montoPagado)}","${d.estado}",,,,,,,,\n`;
      });
      csv+=`"","","","","","","","","","","","","","",""\n`;
    }
  });
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`ControlCredit_Creditos_${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};

const exportarExcelProductos=(productos,ventasContado=[])=>{
  const activos=productos.filter(p=>p.estado!=="Finalizado");
  let csv="TIPO,CLIENTE,PRODUCTO,INVERSIÓN,PRECIO,GANANCIA,CUOTAS,CUOTAS PAGADAS,CUOTAS RESTANTES,VALOR CUOTA,SALDO PENDIENTE,FRECUENCIA,ESTADO\n";
  activos.forEach(p=>{
    const vc=p.valorCuota||Math.round(p.precioFinanciado/p.cuotas);
    const restantes=p.cuotas-p.cuotasPagadas;
    csv+=`"Financiado","${p.clienteNombre}","${p.producto}","${p.inversion}","${p.precioFinanciado}","${p.ganancia}","${p.cuotas}","${p.cuotasPagadas}","${restantes}","${vc}","${restantes*vc}","${p.frecuencia}","${p.estado}"\n`;
  });
  if(ventasContado.length>0){
    csv+=`\nTIPO,CLIENTE,PRODUCTO,COSTO,PRECIO VENTA,GANANCIA,FECHA,,,,,,\n`;
    ventasContado.forEach(v=>{
      csv+=`"Contado","${v.cliente_nombre||"—"}","${v.producto}","${v.costo}","${v.precio_venta}","${v.ganancia}","${fmtFecha(v.fecha)}",,,,,,\n`;
    });
  }
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=`ControlCredit_Productos_${new Date().toLocaleDateString("es-AR").replace(/\//g,"-")}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),2000);
};

// ── BACKUP COMPLETO POR EMAIL ─────────────────────────────────────────────────
const backupPorEmail=(creditos,clientes,productos,ventasContado,emailDestino)=>{
  const fecha=new Date().toLocaleDateString("es-AR");
  const activos=creditos.filter(c=>c.estado!=="Finalizado");
  const prodActivos=productos.filter(p=>p.estado!=="Finalizado");
  const morosos=clientes.filter(c=>c.estado==="Moroso");

  const wb=XLSX.utils.book_new();

  // ── HOJA 1: CRÉDITOS ACTIVOS ──
  const filasCreditos=[
    ["CLIENTE","DNI","TELÉFONO","DIRECCIÓN","ESTADO","FECHA CRÉDITO","CAPITAL","TOTAL A COBRAR","CUOTAS TOTALES","CUOTAS PAGADAS","CUOTAS RESTANTES","VALOR CUOTA","SALDO COBRADO","SALDO PENDIENTE","FRECUENCIA","PRÓX. VENCIMIENTO"],
    ...activos.map(c=>{
      const cl=clientes.find(x=>x.id===c.clienteId);
      return[c.clienteNombre,cl?.dni||"",cl?.tel||"",cl?.direccion||"",c.estado,fmtFecha(c.fechaOtorg),c.monto,c.totalCobrar,c.cuotas,c.cuotasPagadas,c.cuotas-c.cuotasPagadas,c.valorCuota,c.saldoCobrado,c.saldoPendiente,c.frecuencia,fmtFecha(c.proximoPago)];
    })
  ];
  const ws1=XLSX.utils.aoa_to_sheet(filasCreditos);
  ws1["!cols"]=[{wch:25},{wch:12},{wch:14},{wch:30},{wch:12},{wch:14},{wch:12},{wch:14},{wch:8},{wch:8},{wch:8},{wch:12},{wch:12},{wch:14},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws1,"Créditos activos");

  // ── HOJA 2: DETALLE CUOTAS ──
  const filasCuotas=[["CLIENTE","CUOTA #","VENCIMIENTO","FECHA PAGO","VALOR","PAGADO","SALDO","ESTADO"]];
  activos.forEach(c=>{
    (c.detalleCuotas||[]).forEach(d=>{
      const vc=d.valorCuotaEditado||c.valorCuota;
      filasCuotas.push([c.clienteNombre,d.num,fmtFecha(d.fechaVenc),d.fechaPago||"—",vc,d.montoPagado,Math.max(0,vc-d.montoPagado),d.estado]);
    });
  });
  const ws2=XLSX.utils.aoa_to_sheet(filasCuotas);
  ws2["!cols"]=[{wch:25},{wch:8},{wch:14},{wch:14},{wch:12},{wch:12},{wch:12},{wch:12}];
  XLSX.utils.book_append_sheet(wb,ws2,"Detalle cuotas");

  // ── HOJA 3: VENTAS FINANCIADAS ──
  if(prodActivos.length>0){
    const filasVentas=[["CLIENTE","PRODUCTO","INVERSIÓN","PRECIO FINANCIADO","GANANCIA","CUOTAS TOTALES","CUOTAS PAGADAS","CUOTAS RESTANTES","VALOR CUOTA","SALDO PENDIENTE","FRECUENCIA","ESTADO","FECHA"],
      ...prodActivos.map(p=>{
        const vc=p.valorCuota||Math.round(p.precioFinanciado/p.cuotas);
        return[p.clienteNombre,p.producto,p.inversion,p.precioFinanciado,p.ganancia,p.cuotas,p.cuotasPagadas,p.cuotas-p.cuotasPagadas,vc,p.saldoPendiente||((p.cuotas-p.cuotasPagadas)*vc),p.frecuencia,p.estado,fmtFecha(p.fechaOtorg)];
      })
    ];
    const ws3=XLSX.utils.aoa_to_sheet(filasVentas);
    ws3["!cols"]=[{wch:25},{wch:20},{wch:12},{wch:16},{wch:12},{wch:8},{wch:8},{wch:8},{wch:12},{wch:14},{wch:12},{wch:12},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws3,"Ventas financiadas");
  }

  // ── HOJA 4: VENTAS CONTADO ──
  if(ventasContado.length>0){
    const filasContado=[["PRODUCTO","CLIENTE","COSTO","PRECIO VENTA","GANANCIA","FECHA"],
      ...ventasContado.map(v=>[v.producto,v.cliente_nombre||"—",v.costo,v.precio_venta,v.ganancia,fmtFecha(v.fecha)])
    ];
    const ws4=XLSX.utils.aoa_to_sheet(filasContado);
    ws4["!cols"]=[{wch:25},{wch:25},{wch:12},{wch:14},{wch:12},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws4,"Ventas contado");
  }

  // ── HOJA 5: CLIENTES MOROSOS ──
  if(morosos.length>0){
    const filasMorosos=[["NOMBRE","DNI","TELÉFONO","DIRECCIÓN","DEUDA TOTAL"],
      ...morosos.map(m=>{
        const deuda=creditos.filter(c=>c.clienteId===m.id&&c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0);
        return[`${m.nombre} ${m.apellido}`,m.dni||"",m.tel||"",m.direccion||"",deuda];
      })
    ];
    const ws5=XLSX.utils.aoa_to_sheet(filasMorosos);
    ws5["!cols"]=[{wch:25},{wch:12},{wch:14},{wch:30},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws5,"Morosos");
  }

  // ── HOJA 6: RESUMEN ──
  const totalPendiente=activos.reduce((s,c)=>s+c.saldoPendiente,0);
  const gananciaReal=creditos.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0);
  const wsResumen=XLSX.utils.aoa_to_sheet([
    ["RESUMEN CONTROLCREDIT",`Backup ${fecha}`],
    [""],
    ["MÉTRICA","VALOR"],
    ["Créditos activos",activos.length],
    ["Clientes morosos",morosos.length],
    ["Saldo total pendiente",totalPendiente],
    ["Ganancia realizada",gananciaReal],
    ["Ventas financiadas activas",prodActivos.length],
    ["Ventas de contado",ventasContado.length],
  ]);
  wsResumen["!cols"]=[{wch:30},{wch:20}];
  XLSX.utils.book_append_sheet(wb,wsResumen,"Resumen");

  // Descargar el Excel
  const nombreArchivo=`ControlCredit_Backup_${fecha.replace(/\//g,"-")}.xlsx`;
  XLSX.writeFile(wb,nombreArchivo);

  // Abrir Gmail
  const asunto=encodeURIComponent(`ControlCredit — Backup ${fecha}`);
  const cuerpo=encodeURIComponent(`Backup ControlCredit — ${fecha}\n\nCréditos activos: ${activos.length}\nMorosos: ${morosos.length}\nSaldo pendiente: ${fmt(totalPendiente)}\nGanancia realizada: ${fmt(gananciaReal)}\n\nAdjuntá el archivo ${nombreArchivo} descargado.\n\n— ControlCredit`);
  setTimeout(()=>window.open(`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(emailDestino)}&su=${asunto}&body=${cuerpo}`,"_blank"),1000);
};

// ── BUSCADOR DE CLIENTE ───────────────────────────────────────────────────────
const ClienteBuscador=({clients,onSelect,t})=>{
  const [busq,setBusq]=useState("");
  const [seleccionado,setSeleccionado]=useState(null);
  const filtrados=busq.length>=2?clients.filter(c=>{
    const q=busq.toLowerCase();
    return c.nombre.toLowerCase().includes(q)||c.apellido.toLowerCase().includes(q)||(c.dni||"").includes(q);
  }).slice(0,8):[];
  const elegir=(c)=>{setSeleccionado(c);setBusq(`${c.nombre} ${c.apellido}`);onSelect(c);};
  return(
    <div style={{marginBottom:14,position:"relative"}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.05em"}}>Buscar cliente *</label>
      <div style={{position:"relative"}}>
        <input value={busq} onChange={e=>{setBusq(e.target.value);setSeleccionado(null);onSelect(null);}}
          placeholder="Escribí nombre o DNI..."
          style={{width:"100%",padding:"9px 14px 9px 38px",borderRadius:8,border:`1px solid ${seleccionado?t.accent2:t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:t.sub}}>🔍</span>
        {seleccionado&&<span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:t.accent2,fontSize:16}}>✓</span>}
      </div>
      {filtrados.length>0&&!seleccionado&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:t.card,border:`1px solid ${t.border}`,borderRadius:8,boxShadow:"0 8px 24px rgba(0,0,0,0.2)",zIndex:100,maxHeight:220,overflowY:"auto"}}>
          {filtrados.map(c=>(
            <div key={c.id} onClick={()=>elegir(c)}
              style={{padding:"10px 14px",cursor:"pointer",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.background=t.bg}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div>
                <div style={{fontWeight:600,color:t.text,fontSize:13}}>{c.nombre} {c.apellido}</div>
                <div style={{fontSize:11,color:t.sub}}>DNI: {c.dni||"—"} · {c.tel||"sin tel"}</div>
              </div>
              <span style={{fontSize:10,background:c.estado==="Al día"?"#d1fae5":c.estado==="Moroso"?"#fee2e2":"#fef3c7",color:c.estado==="Al día"?"#065f46":c.estado==="Moroso"?"#991b1b":"#92400e",padding:"2px 7px",borderRadius:20,fontWeight:600}}>{c.estado}</span>
            </div>
          ))}
        </div>
      )}
      {busq.length>=2&&filtrados.length===0&&!seleccionado&&(
        <div style={{background:t.bg,borderRadius:8,padding:"10px 14px",marginTop:4,fontSize:12,color:t.sub}}>No se encontraron clientes</div>
      )}
    </div>
  );
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
  const [editFechaPago,setEditFechaPago]=useState("");
  const [modo,setModo]=useState("fecha"); // "fecha" | "pago" | "valor" | "fechapago"
  const detalles=credito.detalleCuotas||[];

  const abrirEditFecha=(i)=>{setEditIdx(i);setEditFecha(detalles[i]?.fechaVenc||"");setModo("fecha");};
  const abrirEditPago=(i)=>{setEditIdx(i);setEditMonto(detalles[i]?.montoPagado?.toString()||"0");setModo("pago");};
  const abrirEditValor=(i)=>{setEditIdx(i);setEditValorCuota((detalles[i]?.valorCuotaEditado||credito.valorCuota)?.toString()||"");setModo("valor");};
  const abrirEditFechaPago=(i)=>{
    // Convertir fecha de pago de formato dd/mm/yyyy a yyyy-mm-dd para el input date
    const fp=detalles[i]?.fechaPago||"";
    let fechaInput="";
    if(fp){
      const partes=fp.split("/");
      if(partes.length===3)fechaInput=`${partes[2]}-${partes[1].padStart(2,"0")}-${partes[0].padStart(2,"0")}`;
    }
    if(!fechaInput)fechaInput=new Date().toISOString().slice(0,10);
    setEditIdx(i);setEditFechaPago(fechaInput);setModo("fechapago");
  };

  const guardarFechaPago=()=>{
    if(editIdx===null)return;
    const nuevos=[...detalles];
    // Convertir yyyy-mm-dd a dd/mm/yyyy
    const [y,m,d]=editFechaPago.split("-");
    const fechaFormateada=`${d}/${m}/${y}`;
    nuevos[editIdx]={...nuevos[editIdx],fechaPago:fechaFormateada};
    onActualizar({...credito,detalleCuotas:nuevos});
    setEditIdx(null);
  };

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
                    {d.fechaPago&&(
                      <div style={{display:"flex",alignItems:"center",gap:3,marginTop:2}}>
                        {editandoEsta&&modo==="fechapago"?(
                          <div style={{display:"flex",gap:3,alignItems:"center"}}>
                            <input type="date" value={editFechaPago} onChange={e=>setEditFechaPago(e.target.value)}
                              style={{padding:"3px 6px",borderRadius:5,border:`1px solid #10b981`,background:t.input,color:t.text,fontSize:11,outline:"none"}}/>
                            <button onClick={guardarFechaPago} style={{background:"#10b981",border:"none",borderRadius:5,padding:"3px 6px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:700}}>OK</button>
                            <button onClick={()=>setEditIdx(null)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:5,padding:"3px 5px",color:t.sub,cursor:"pointer"}}><Icon name="close" size={10}/></button>
                          </div>
                        ):(
                          <div style={{display:"flex",alignItems:"center",gap:3}}>
                            <span style={{fontSize:10,color:"#10b981"}}>{d.fechaPago}</span>
                            <button onClick={()=>abrirEditFechaPago(i)} style={{background:"none",border:"none",cursor:"pointer",color:"#10b981",padding:1,display:"flex",alignItems:"center"}} title="Editar fecha de pago"><Icon name="edit" size={10}/></button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{padding:"8px 10px"}}>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      <button onClick={()=>abrirEditFecha(i)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"4px 7px",cursor:"pointer",color:t.sub,fontSize:10,display:"flex",alignItems:"center",gap:2}} title="Editar fecha"><Icon name="calendar" size={11}/></button>
                      <button onClick={()=>abrirEditValor(i)} style={{background:"none",border:"1px solid #f59e0b",borderRadius:6,padding:"4px 7px",cursor:"pointer",color:"#f59e0b",fontSize:10,fontWeight:700}} title="Editar valor por mora">$+</button>
                      <button onClick={()=>abrirEditPago(i)} style={{background:"none",border:`1px solid ${t.accent2}`,borderRadius:6,padding:"4px 7px",cursor:"pointer",color:t.accent2,fontSize:10,display:"flex",alignItems:"center",gap:2}} title="Editar pago parcial"><Icon name="edit" size={11}/></button>
                      {d.estado!=="Pagada"&&<button onClick={()=>{
                        const vc=d.valorCuotaEditado||credito.valorCuota;
                        const nuevos=[...detalles];
                        nuevos[i]={...nuevos[i],montoPagado:vc,estado:"Pagada",fechaPago:new Date().toLocaleDateString("es-AR")};
                        const totalCobrado=nuevos.reduce((s,x)=>s+x.montoPagado,0);
                        const nuevoTotal=nuevos.reduce((s,x)=>s+(x.valorCuotaEditado||credito.valorCuota),0);
                        const totalPendiente=Math.max(0,nuevoTotal-totalCobrado);
                        const cuotasPagadas=nuevos.filter(x=>x.estado==="Pagada").length;
                        const proxPendiente=nuevos.find(x=>x.estado!=="Pagada");
                        const nuevoEstado=totalPendiente<=0?"Finalizado":credito.estado==="Moroso"?"Atrasado":credito.estado;
                        onActualizar({...credito,detalleCuotas:nuevos,saldoCobrado:totalCobrado,saldoPendiente:totalPendiente,totalCobrar:nuevoTotal,cuotasPagadas,proximoPago:proxPendiente?.fecheVenc||credito.proximoPago,estado:nuevoEstado,historial:[...credito.historial,{tipo:"pago_completo",cuota:i+1,monto:vc,fecha:new Date().toLocaleDateString("es-AR")}]});
                      }} style={{background:"#10b981",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"#fff",fontSize:10,fontWeight:700}} title="Marcar cuota como pagada completa">✓ Pagada</button>}
                      {/* PAGO ANTICIPADO CON DESCUENTO */}
                      {d.estado!=="Pagada"&&(()=>{
                        const vc=d.valorCuotaEditado||credito.valorCuota;
                        const gananciaCuota=credito.ganancia/credito.cuotas;
                        const capitalCuota=credito.monto/credito.cuotas;
                        const esAnticipada=d.fechaVenc&&new Date(d.fechaVenc)>new Date();
                        if(!esAnticipada)return null;
                        return(
                          <button
                            onClick={()=>{
                              const pctInput=window.prompt(
                                `🎁 Pago anticipado — Cuota ${d.num}\n\nValor original: ${fmt(vc)}\nCapital de esta cuota: ${fmt(capitalCuota)}\nGanancia de esta cuota: ${fmt(gananciaCuota)}\n\n¿Qué % de la GANANCIA querés descontarle al cliente?\nEj: 50 = le descontás la mitad de tu ganancia\n\n(El capital de ${fmt(capitalCuota)} siempre se cobra completo)`
                              );
                              if(!pctInput)return;
                              const pctDesc=Math.min(100,Math.max(0,+pctInput||0));
                              const descuento=Math.round(gananciaCuota*(pctDesc/100));
                              const montoFinal=Math.round(vc-descuento);
                              const ok=window.confirm(
                                `Confirmar descuento\n\nValor original: ${fmt(vc)}\nDescuento (${pctDesc}% de ganancia): -${fmt(descuento)}\nEl cliente paga: ${fmt(montoFinal)}\n\n¿Confirmar pago anticipado?`
                              );
                              if(!ok)return;
                              const nuevos=[...detalles];
                              nuevos[i]={...nuevos[i],montoPagado:montoFinal,estado:"Pagada",fechaPago:new Date().toLocaleDateString("es-AR"),valorCuotaEditado:montoFinal};
                              const totalCobrado=nuevos.reduce((s,x)=>s+x.montoPagado,0);
                              const nuevoTotal=nuevos.reduce((s,x)=>s+(x.valorCuotaEditado||credito.valorCuota),0);
                              const totalPendiente=Math.max(0,nuevoTotal-totalCobrado);
                              const cuotasPagadas=nuevos.filter(x=>x.estado==="Pagada").length;
                              const proxPendiente=nuevos.find(x=>x.estado!=="Pagada");
                              const nuevoEstado=totalPendiente<=0?"Finalizado":credito.estado;
                              onActualizar({...credito,detalleCuotas:nuevos,saldoCobrado:totalCobrado,saldoPendiente:totalPendiente,totalCobrar:nuevoTotal,cuotasPagadas,proximoPago:proxPendiente?.fechaVenc||credito.proximoPago,estado:nuevoEstado,
                                historial:[...credito.historial,{tipo:"pago_anticipado",cuota:i+1,descuento:`${pctDesc}% de ganancia`,montoOriginal:vc,montoPagado:montoFinal,ahorro:descuento,fecha:new Date().toLocaleDateString("es-AR")}]});
                            }}
                            style={{background:"none",border:"1px solid #8b5cf6",borderRadius:6,padding:"4px 7px",cursor:"pointer",color:"#8b5cf6",fontSize:10,fontWeight:700}}
                            title="Pago anticipado con descuento sobre la ganancia">
                            🎁 Desc.
                          </button>
                        );
                      })()}
                      {d.estado==="Pagada"&&<button onClick={()=>{
                        if(!window.confirm("¿Restablecer esta cuota a pendiente?"))return;
                        const nuevos=[...detalles];
                        nuevos[i]={...nuevos[i],montoPagado:0,estado:"Pendiente",fechaPago:null};
                        const totalCobrado=Math.max(0,nuevos.reduce((s,x)=>s+x.montoPagado,0));
                        const nuevoTotal=nuevos.reduce((s,x)=>s+(x.valorCuotaEditado||credito.valorCuota),0);
                        const totalPendiente=Math.max(0,nuevoTotal-totalCobrado);
                        const cuotasPagadas=nuevos.filter(x=>x.estado==="Pagada").length;
                        const proxPendiente=nuevos.find(x=>x.estado!=="Pagada");
                        onActualizar({...credito,detalleCuotas:nuevos,saldoCobrado:totalCobrado,saldoPendiente:totalPendiente,totalCobrar:nuevoTotal,cuotasPagadas,proximoPago:proxPendiente?.fechaVenc||credito.proximoPago,estado:"Al día",historial:[...credito.historial,{tipo:"restablecer_cuota",cuota:i+1,fecha:new Date().toLocaleDateString("es-AR")}]});
                      }} style={{background:"none",border:"1px solid #f59e0b",borderRadius:6,padding:"4px 7px",cursor:"pointer",color:"#f59e0b",fontSize:10,fontWeight:700}} title="Restablecer cuota a pendiente">↩ Reset</button>}
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
            {[["Email",client.email],["Teléfono",client.tel],["Nacimiento",client.nacimiento],["Estado civil",client.estadoCivil],["Ciudad",client.ciudad],["Provincia",client.provincia],["Dirección",client.direccion]].map(([k,v])=>v?(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${t.border}`}}><span style={{fontSize:11,color:t.sub}}>{k}</span><span style={{fontSize:11,fontWeight:600,color:t.text}}>{v}</span></div>):null)}
            {client.mapsLink&&<a href={client.mapsLink} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:t.accent,marginTop:6,textDecoration:"none"}}>🗺 Ver domicilio en Google Maps</a>}
          </div>
          <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:"16px 18px"}}>
            <h3 style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:t.text}}>💼 Trabajo</h3>
            {[["Ocupación",client.ocupacion],["Empresa",client.empresa],["Sueldo",client.sueldo?fmt(client.sueldo):null]].map(([k,v])=>v?(<div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${t.border}`}}><span style={{fontSize:11,color:t.sub}}>{k}</span><span style={{fontSize:11,fontWeight:600,color:t.text}}>{v}</span></div>):null)}
            {client.notas&&<div style={{marginTop:10}}><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Notas</div><div style={{fontSize:11,color:t.text,background:t.bg,borderRadius:7,padding:"8px 10px"}}>{client.notas}</div></div>}
          </div>
        </div>
        {/* DOCUMENTOS DNI */}
        <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,padding:"16px 18px",marginBottom:14}}>
          <h3 style={{margin:"0 0 12px",fontSize:13,fontWeight:700,color:t.text}}>🪪 Documentos del cliente</h3>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <div style={{fontSize:11,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>DNI — Frente</div>
              {client.dniFrenteUrl&&<img src={client.dniFrenteUrl} alt="DNI frente" style={{width:"100%",borderRadius:8,marginBottom:6,border:`1px solid ${t.border}`,maxHeight:120,objectFit:"cover"}} onError={e=>e.target.style.display='none'}/>}
              <UploadBtn label="Subir DNI frente" url={client.dniFrenteUrl} accept="image/*" color="#3b82f6" t={t}
                onUpload={async(url)=>{
                  await sb.from("clientes").update({dni_frente:url}).eq("id",client.id);
                  client.dniFrenteUrl=url;
                }}/>
            </div>
            <div>
              <div style={{fontSize:11,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:8}}>DNI — Dorso</div>
              {client.dniDorsoUrl&&<img src={client.dniDorsoUrl} alt="DNI dorso" style={{width:"100%",borderRadius:8,marginBottom:6,border:`1px solid ${t.border}`,maxHeight:120,objectFit:"cover"}} onError={e=>e.target.style.display='none'}/>}
              <UploadBtn label="Subir DNI dorso" url={client.dniDorsoUrl} accept="image/*" color="#8b5cf6" t={t}
                onUpload={async(url)=>{
                  await sb.from("clientes").update({dni_dorso:url}).eq("id",client.id);
                  client.dniDorsoUrl=url;
                }}/>
            </div>
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
const ROLES=[
  {value:"empresario",label:"Empresario",desc:"Puede crear, editar y eliminar todo",color:"#10b981",bg:"#d1fae5"},
  {value:"administrador",label:"Administrador",desc:"Solo puede ver, no edita ni elimina",color:"#3b82f6",bg:"#dbeafe"},
  {value:"admin",label:"Admin total",desc:"Acceso completo incluyendo usuarios",color:"#8b5cf6",bg:"#ede9fe"},
];

const getRolInfo=(rol)=>ROLES.find(r=>r.value===rol)||{value:rol,label:rol,color:"#64748b",bg:"#f1f5f9"};

const AdminUsuarios=({t,allClients,allCreditos,allProductos,allVentasContado})=>{
  const [usuarios,setUsuarios]=useState([]);
  const [modal,setModal]=useState(false);
  const [editModal,setEditModal]=useState(false);
  const [usuarioEditando,setUsuarioEditando]=useState(null);
  const [verEmpleado,setVerEmpleado]=useState(null);
  const [form,setForm]=useState({nombre:"",user_name:"",password:"",rol:"empresario"});
  const [formEdit,setFormEdit]=useState({nombre:"",user_name:"",password:"",rol:"empresario"});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    sb.from("usuarios").select("*").then(({data})=>{if(data)setUsuarios(data.map(usuarioFromDB));});
  },[]);

  const save=async()=>{
    if(!form.nombre||!form.user_name||!form.password)return;
    setLoading(true);
    const {data}=await sb.from("usuarios").insert({nombre:form.nombre,user_name:form.user_name,password:form.password,rol:form.rol,activo:true}).select().single();
    if(data)setUsuarios(us=>[...us,usuarioFromDB(data)]);
    setLoading(false);setModal(false);setForm({nombre:"",user_name:"",password:"",rol:"empresario"});
  };

  const abrirEdicion=(u)=>{
    setUsuarioEditando(u);
    setFormEdit({nombre:u.nombre,user_name:u.user,password:"",rol:u.rol});
    setEditModal(true);
  };

  const guardarEdicion=async()=>{
    if(!formEdit.nombre||!formEdit.user_name)return;
    setLoading(true);
    const data={nombre:formEdit.nombre,user_name:formEdit.user_name,rol:formEdit.rol};
    if(formEdit.password)data.password=formEdit.password;
    await sb.from("usuarios").update(data).eq("id",usuarioEditando.id);
    setUsuarios(us=>us.map(u=>u.id===usuarioEditando.id?{...u,nombre:formEdit.nombre,user:formEdit.user_name,rol:formEdit.rol}:u));
    setLoading(false);setEditModal(false);setUsuarioEditando(null);
  };

  const toggleActivo=async(u)=>{
    await sb.from("usuarios").update({activo:!u.activo}).eq("id",u.id);
    setUsuarios(us=>us.map(x=>x.id===u.id?{...x,activo:!x.activo}:x));
  };

  const del=async(id)=>{
    if(window.confirm("¿Eliminar usuario?")){ await sb.from("usuarios").delete().eq("id",id); setUsuarios(us=>us.filter(u=>u.id!==id)); }
  };

  const getMetricas=(uid)=>{
    const cls=(allClients||[]).filter(c=>c.usuarioId===uid);
    const crs=(allCreditos||[]).filter(c=>c.usuarioId===uid);
    const activos=crs.filter(c=>c.estado!=="Finalizado");
    const ganReal=crs.reduce((s,c)=>s+(c.ganancia/c.cuotas)*c.cuotasPagadas,0)+((allVentasContado||[]).filter(v=>v.usuario_id===uid)).reduce((s,v)=>s+v.ganancia,0);
    const morosos=cls.filter(c=>c.estado==="Moroso").length;
    return{clientes:cls.length,activos:activos.length,ganReal,morosos,crs};
  };

  const SelectorRol=({value,onChange})=>(
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:8,textTransform:"uppercase"}}>Rol del usuario</label>
      <div style={{display:"grid",gap:8}}>
        {ROLES.map(r=>(
          <div key={r.value} onClick={()=>onChange(r.value)}
            style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:`2px solid ${value===r.value?r.color:t.border}`,background:value===r.value?r.bg:"transparent",cursor:"pointer",transition:"all 0.15s"}}>
            <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${r.color}`,background:value===r.value?r.color:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {value===r.value&&<div style={{width:8,height:8,borderRadius:"50%",background:"#fff"}}/>}
            </div>
            <div>
              <div style={{fontWeight:700,color:value===r.value?r.color:t.text,fontSize:13}}>{r.label}</div>
              <div style={{fontSize:11,color:t.sub}}>{r.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return(
    <div>
      {/* MODAL EDITAR USUARIO */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title={`Editar usuario — ${usuarioEditando?.nombre}`} t={t}>
        {usuarioEditando&&(
          <div>
            <Field label="Nombre completo" value={formEdit.nombre} onChange={v=>setFormEdit(f=>({...f,nombre:v}))} t={t}/>
            <Field label="Nombre de usuario" value={formEdit.user_name} onChange={v=>setFormEdit(f=>({...f,user_name:v}))} t={t}/>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase"}}>Nueva contraseña (dejá vacío para no cambiar)</label>
              <input type="password" value={formEdit.password} onChange={e=>setFormEdit(f=>({...f,password:e.target.value}))} placeholder="Nueva contraseña..."
                style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <SelectorRol value={formEdit.rol} onChange={v=>setFormEdit(f=>({...f,rol:v}))}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:8}}>
              <button onClick={()=>setEditModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Guardar cambios"}</button>
            </div>
          </div>
        )}
      </Modal>
      {verEmpleado&&(
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"stretch"}}>
          <div onClick={()=>setVerEmpleado(null)} style={{flex:1,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(3px)",cursor:"pointer"}}/>
          <div style={{width:"min(580px,95vw)",background:t.bg,overflowY:"auto",boxShadow:"-8px 0 40px rgba(0,0,0,0.35)"}}>
            <div style={{background:t.card,borderBottom:`1px solid ${t.border}`,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
              <div><div style={{fontSize:16,fontWeight:800,color:t.text}}>{verEmpleado.nombre}</div><div style={{fontSize:12,color:t.sub}}>@{verEmpleado.user} · <span style={{color:"#3b82f6",fontWeight:600}}>{verEmpleado.rol}</span></div></div>
              <button onClick={()=>setVerEmpleado(null)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 12px",cursor:"pointer",color:t.sub,fontSize:13,fontWeight:600}}>✕ Cerrar</button>
            </div>
            <div style={{padding:"20px"}}>
              {(()=>{
                const m=getMetricas(verEmpleado.id);
                return(
                  <div>
                    <h3 style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:t.text}}>📊 Métricas de {verEmpleado.nombre}</h3>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
                      {[{label:"Clientes",value:m.clientes,color:"#f59e0b"},{label:"Créditos activos",value:m.activos,color:"#3b82f6"},{label:"Ganancia realizada",value:fmt(m.ganReal),color:"#8b5cf6"},{label:"Morosos",value:m.morosos,color:"#ef4444"}].map(({label,value,color})=>(
                        <div key={label} style={{background:t.card,borderRadius:10,padding:"12px 16px",border:`1px solid ${t.border}`}}>
                          <div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>{label}</div>
                          <div style={{fontSize:18,fontWeight:800,color}}>{value}</div>
                        </div>
                      ))}
                    </div>
                    {m.crs.length>0?(
                      <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.border}`,overflow:"hidden"}}>
                        <div style={{padding:"10px 16px",background:t.bg,fontSize:12,fontWeight:700,color:t.text}}>💳 Créditos activos</div>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr style={{background:t.bg}}>{["Cliente","Capital","Saldo","Estado"].map(h=><th key={h} style={{padding:"7px 12px",textAlign:"left",fontSize:10,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                          <tbody>{m.crs.filter(c=>c.estado!=="Finalizado").map(c=>(
                            <tr key={c.id} style={{borderTop:`1px solid ${t.border}`}}>
                              <td style={{padding:"8px 12px",fontWeight:600,color:t.text}}>{c.clienteNombre}</td>
                              <td style={{padding:"8px 12px",color:t.text}}>{fmt(c.monto)}</td>
                              <td style={{padding:"8px 12px",color:"#ef4444",fontWeight:700}}>{fmt(c.saldoPendiente)}</td>
                              <td style={{padding:"8px 12px"}}><span style={{fontSize:11,fontWeight:600,color:c.estado==="Al día"?"#10b981":c.estado==="Moroso"?"#ef4444":"#f59e0b"}}>{c.estado}</span></td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ):<div style={{textAlign:"center",padding:"30px",color:t.sub,fontSize:13}}>Este empleado aún no tiene datos cargados.</div>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>👥 Panel de Usuarios</h1><p style={{color:t.sub,margin:0,fontSize:13}}>Tocá "Ver datos" para ver las métricas de cada empleado</p></div>
        <button onClick={()=>setModal(true)} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nuevo usuario</button>
      </div>
      <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:t.bg}}>{["Nombre","Usuario","Rol","Estado","Resumen","Acciones"].map(h=><th key={h} style={{padding:"11px 15px",textAlign:"left",fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
          <tbody>
            {usuarios.map(u=>{
              const m=getMetricas(u.id);
              const rolInfo=getRolInfo(u.rol);
              return(
                <tr key={u.id} style={{borderTop:`1px solid ${t.border}`}}>
                  <td style={{padding:"12px 15px",fontWeight:600,color:t.text}}>{u.nombre}</td>
                  <td style={{padding:"12px 15px",color:t.sub,fontSize:13}}>@{u.user}</td>
                  <td style={{padding:"12px 15px"}}>
                    <div>
                      <span style={{background:rolInfo.bg,color:rolInfo.color,padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:700}}>{rolInfo.label}</span>
                      <div style={{fontSize:10,color:t.sub,marginTop:3}}>{rolInfo.desc}</div>
                    </div>
                  </td>
                  <td style={{padding:"12px 15px"}}><span style={{background:u.activo?"#d1fae5":"#fee2e2",color:u.activo?"#065f46":"#991b1b",padding:"2px 10px",borderRadius:20,fontSize:12,fontWeight:600}}>{u.activo?"Activo":"Inactivo"}</span></td>
                  <td style={{padding:"12px 15px",fontSize:12,color:t.sub}}><span style={{color:"#3b82f6",fontWeight:600}}>{m.clientes} clientes</span> · <span style={{color:"#8b5cf6",fontWeight:600}}>{fmt(m.ganReal)}</span></td>
                  <td style={{padding:"12px 15px"}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>setVerEmpleado(u)} style={{background:"none",border:`1px solid ${t.accent}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",color:t.accent,fontSize:11,fontWeight:700}}>Ver datos</button>
                      <button onClick={()=>abrirEdicion(u)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:t.sub}} title="Editar usuario"><Icon name="edit" size={13}/></button>
                      <button onClick={()=>toggleActivo(u)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 10px",cursor:"pointer",color:t.sub,fontSize:11,fontWeight:600}}>{u.activo?"Pausar":"Activar"}</button>
                      <button onClick={()=>del(u.id)} style={{background:"none",border:"1px solid #fca5a5",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#ef4444"}}><Icon name="trash" size={13}/></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {usuarios.length===0&&<tr><td colSpan={6} style={{padding:"30px",textAlign:"center",color:t.sub}}>No hay usuarios creados</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={()=>setModal(false)} title="Nuevo usuario" t={t}>
        <Field label="Nombre completo *" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))} t={t}/>
        <Field label="Nombre de usuario *" value={form.user_name} onChange={v=>setForm(f=>({...f,user_name:v}))} t={t} placeholder="Ej: maria123"/>
        <Field label="Contraseña *" value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} t={t}/>
        <SelectorRol value={form.rol} onChange={v=>setForm(f=>({...f,rol:v}))}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Crear usuario"}</button>
        </div>
      </Modal>
    </div>
  );
};
const Dashboard=({clients,creditos,setCreditos,productos,setProductos,ventasContado=[],t})=>{
  const hoy=new Date();hoy.setHours(0,0,0,0);
  const [mesPDF,setMesPDF]=useState(hoy.getMonth()+1);
  const [anioPDF,setAnioPDF]=useState(hoy.getFullYear());
  const [tabPagos,setTabPagos]=useState("aldia");
  const [ordenRank,setOrdenRank]=useState("ganEsp");
  const [clienteExpandido,setClienteExpandido]=useState(null);
  const [editandoMeta,setEditandoMeta]=useState(false);
  const [meta,setMeta]=useState({ganancia:"",clientes:""});
  const [metaGuardada,setMetaGuardada]=useState({ganancia:0,clientes:0});
  const [emailBackup,setEmailBackup]=useState("");
  const [showEmailInput,setShowEmailInput]=useState(false);

  const activos=creditos.filter(c=>c.estado!=="Finalizado");
  const productosActivos=productos.filter(p=>p.estado!=="Finalizado");
  // Capital en la calle = créditos + inversión en productos activos
  const plata=activos.reduce((s,c)=>s+(c.monto-c.monto*(c.cuotasPagadas/c.cuotas)),0)
    +productosActivos.reduce((s,p)=>s+(p.inversion-(p.inversion*(p.cuotasPagadas/p.cuotas))),0);
  // Por cobrar = saldo pendiente créditos + saldo pendiente productos
  const porCobrar=activos.reduce((s,c)=>s+c.saldoPendiente,0)
    +productosActivos.reduce((s,p)=>s+Math.max(0,p.precioFinanciado-p.saldoCobrado),0);
  // Ganancia esperada = total a cobrar - capital prestado (incluye moras editadas)
  const ganEsp=creditos.reduce((s,c)=>{
    const totalReal=(c.detalleCuotas&&c.detalleCuotas.length>0)
      ?c.detalleCuotas.reduce((ss,d)=>ss+(d.valorCuotaEditado||c.valorCuota),0)
      :c.totalCobrar;
    return s+(totalReal-c.monto);
  },0)+productos.reduce((s,p)=>s+p.ganancia,0);

  // Ganancia realizada = lo efectivamente cobrado - capital recuperado
  // Así si cobraste $120 en vez de $100 (mora), impacta +$20 extra
  // Si cobraste $80 en vez de $100 (descuento), impacta -$20
  const ganReal=creditos.reduce((s,c)=>{
    const capitalPorCuota=c.monto/c.cuotas;
    const capitalRecuperado=capitalPorCuota*c.cuotasPagadas;
    const gananciaReal=c.saldoCobrado-capitalRecuperado;
    return s+gananciaReal;
  },0)
    +productos.reduce((s,p)=>{
      const capitalPorCuota=p.inversion/p.cuotas;
      const capitalRecuperado=capitalPorCuota*p.cuotasPagadas;
      return s+p.saldoCobrado-capitalRecuperado;
    },0)
    +(ventasContado||[]).reduce((s,v)=>s+v.ganancia,0);
  const nMorosos=clients.filter(c=>c.estado==="Moroso").length;
  const nAlDia=clients.filter(c=>c.estado==="Al día"||c.estado==="Premium").length;
  const alertas=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado");
  const COLORS=["#3b82f6","#ef4444","#f59e0b","#8b5cf6"];
  const pie=[{name:"Al día",value:nAlDia},{name:"Morosos",value:nMorosos},{name:"Atrasados",value:clients.filter(c=>c.estado==="Atrasado").length}].filter(d=>d.value>0);

  // Flujo de efectivo — usa valores reales incluyendo moras y descuentos
  const totalCobradoReal=creditos.reduce((s,c)=>s+c.saldoCobrado,0)
    +productos.reduce((s,p)=>s+p.saldoCobrado,0)
    +(ventasContado||[]).reduce((s,v)=>s+v.precio_venta,0);
  // Total proyectado = suma de valores reales de cada cuota (con moras/descuentos aplicados)
  const totalProyectadoCreditos=creditos.reduce((s,c)=>{
    if(c.detalleCuotas&&c.detalleCuotas.length>0)
      return s+c.detalleCuotas.reduce((ss,d)=>ss+(d.valorCuotaEditado||c.valorCuota),0);
    return s+c.totalCobrar;
  },0);
  const totalPendienteReal=Math.max(0,totalProyectadoCreditos-creditos.reduce((s,c)=>s+c.saldoCobrado,0))
    +productosActivos.reduce((s,p)=>s+Math.max(0,p.precioFinanciado-p.saldoCobrado),0);
  const flujoTotal=totalCobradoReal+totalPendienteReal;
  const capitalRecuperadoTotal=creditos.reduce((s,c)=>s+(c.monto/c.cuotas)*c.cuotasPagadas,0);
  const interesesCobrados=Math.max(0,creditos.reduce((s,c)=>s+c.saldoCobrado,0)-capitalRecuperadoTotal);
  const morasCobradas=creditos.reduce((s,c)=>{
    const det=c.detalleCuotas||[];
    return s+det.reduce((ss,d)=>{const extra=(d.valorCuotaEditado||0)-(c.valorCuota||0);return ss+(extra>0&&d.estado==="Pagada"?extra:0);},0);
  },0);

  // ── PAGOS: nueva lógica ──
  // Al día: vence hoy o hasta 3 días después (período de gracia)
  // Vencido: entre 4 y 15 días sin pagar
  // Moroso: más de 15 días sin pagar
  // Un cliente aparece UNA SOLA VEZ aunque tenga varias cuotas vencidas
  // Si ya pagó todas las cuotas del período → no aparece
  const [mensajeEditando,setMensajeEditando]=useState(null);
  const [showCobros,setShowCobros]=useState(false); // clienteId del que está editando
  const [mensajeTexto,setMensajeTexto]=useState({});
  const getMensaje=(c,clienteInfo)=>{
    const nombre=clienteInfo?.nombre||c.clienteNombre?.split(" ")[0]||"cliente";
    if(mensajeTexto[c.clienteId]!==undefined)return mensajeTexto[c.clienteId];
    return `Hola ${nombre}, ¿cómo estás? Te escribía el día de hoy por el pago pactado.`;
  };
  const abrirMensaje=(c,clienteInfo,e)=>{
    e.stopPropagation();
    if(mensajeEditando===c.clienteId){setMensajeEditando(null);return;}
    if(mensajeTexto[c.clienteId]===undefined){
      const nombre=clienteInfo?.nombre||c.clienteNombre?.split(" ")[0]||"cliente";
      setMensajeTexto(m=>({...m,[c.clienteId]:`Hola ${nombre}, ¿cómo estás? Te escribía el día de hoy por el pago pactado.`}));
    }
    setMensajeEditando(c.clienteId);
  };
  const enviarWA=(tel,mensaje,e)=>{
    e.stopPropagation();
    const num=`54${tel.replace(/\D/g,"")}`;
    const txt=encodeURIComponent(mensaje);
    window.open(`https://wa.me/${num}?text=${txt}`,"_blank");
    setMensajeEditando(null);
  };

  // Unificar créditos y ventas financiadas activas para la sección de Pagos
  const itemsFuentePagos=[
    ...activos.map(c=>({...c,_tipo:"credito"})),
    ...productosActivos.map(p=>({...p,monto:p.inversion,totalCobrar:p.precioFinanciado,ganancia:p.ganancia,historial:[],_tipo:"producto",_etiqueta:p.producto})),
  ];

  const itemsPagosRaw=itemsFuentePagos.map(c=>{
    const det=c.detalleCuotas||[];
    const pendientes=det.filter(d=>d.estado==="Pendiente"||d.estado==="Parcial").sort((a,b)=>new Date(a.fechaVenc)-new Date(b.fechaVenc));
    if(pendientes.length===0)return null;
    const proxCuota=pendientes[0];
    const proxFecha=proxCuota.fechaVenc?new Date(proxCuota.fechaVenc):c.proximoPago?new Date(c.proximoPago):null;
    if(proxFecha)proxFecha.setHours(0,0,0,0);
    const diffDias=proxFecha?Math.round((proxFecha-hoy)/(1000*60*60*24)):null;
    if(diffDias===null)return null;
    let cat=null;
    if(diffDias>=0&&diffDias<=3)cat="aldia";
    else if(diffDias<0&&diffDias>=-15)cat="vencido";
    else if(diffDias<-15)cat="moroso";
    else return null;
    const cuotasVencidas=det.filter(d=>(d.estado==="Pendiente"||d.estado==="Parcial")&&d.fechaVenc&&new Date(d.fechaVenc)<hoy);
    return{...c,proxFecha,diffDias,cat,proxCuota,pendientes,cuotasVencidas};
  }).filter(Boolean);

  // Cada ítem aparece por separado (crédito y venta del mismo cliente no se pisan)
  const catPrioridad={moroso:3,vencido:2,aldia:1};
  const itemsPagos=itemsPagosRaw.sort((a,b)=>catPrioridad[b.cat]-catPrioridad[a.cat]);
  const pagosAlDia=itemsPagos.filter(i=>i.cat==="aldia");
  const pagosPorVencer=itemsPagos.filter(i=>i.cat==="vencido");
  const pagosMorosos=itemsPagos.filter(i=>i.cat==="moroso");
  const tabsConfig=[
    {id:"aldia",label:"Al día",count:pagosAlDia.length,color:"#10b981",bg:"#d1fae510",border:"#10b98130"},
    {id:"vencido",label:"Vencidos",count:pagosPorVencer.length,color:"#f59e0b",bg:"#fef3c710",border:"#f59e0b30"},
    {id:"moroso",label:"Morosos",count:pagosMorosos.length,color:"#ef4444",bg:"#fee2e210",border:"#ef444430"},
  ];
  const listaActiva=tabPagos==="aldia"?pagosAlDia:tabPagos==="vencido"?pagosPorVencer:pagosMorosos;
  const tabActiva=tabsConfig.find(tab=>tab.id===tabPagos)||tabsConfig[0];

  return(
    <div>
      <div style={{marginBottom:22,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div><h1 style={{fontSize:24,fontWeight:800,color:t.text,margin:"0 0 4px"}}>Dashboard</h1><p style={{color:t.sub,margin:0,fontSize:14}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</p></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          {/* BACKUP EMAIL */}
          <div style={{display:"flex",gap:6,alignItems:"center",background:t.card,padding:"8px 12px",borderRadius:10,border:`1px solid ${t.border}`}}>
            {showEmailInput?(
              <>
                <input value={emailBackup} onChange={e=>setEmailBackup(e.target.value)} placeholder="tucorreo@gmail.com" type="email"
                  style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:"none",width:200}}/>
                <button onClick={()=>{if(!emailBackup){alert("Ingresá tu email");return;}backupPorEmail(creditos,clients,productos,ventasContado,emailBackup);setShowEmailInput(false);}}
                  style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  💾 Enviar
                </button>
                <button onClick={()=>setShowEmailInput(false)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer",color:t.sub}}>✕</button>
              </>
            ):(
              <button onClick={()=>setShowEmailInput(true)}
                style={{background:"none",border:"none",cursor:"pointer",color:"#3b82f6",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>
                💾 Backup por email
              </button>
            )}
          </div>
          {/* REPORTE PDF */}
          <div style={{display:"flex",gap:8,alignItems:"center",background:t.card,padding:"10px 14px",borderRadius:12,border:`1px solid ${t.border}`}}>
            <span style={{fontSize:12,color:t.sub,fontWeight:600}}>Reporte:</span>
            <select value={mesPDF} onChange={e=>setMesPDF(+e.target.value)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:"none"}}>
              {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m,i)=><option key={i} value={i+1}>{m}</option>)}
            </select>
            <select value={anioPDF} onChange={e=>setAnioPDF(+e.target.value)} style={{padding:"5px 8px",borderRadius:6,border:`1px solid ${t.border}`,background:t.input,color:t.text,fontSize:12,outline:"none"}}>
              {[2024,2025,2026,2027].map(a=><option key={a} value={a}>{a}</option>)}
            </select>
            <button onClick={()=>generateReporteMensual(creditos,clients,productos,mesPDF,anioPDF,ventasContado)} style={{background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
              <Icon name="pdf" size={14}/>Generar PDF
            </button>
          </div>
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
        <MetricCard label="Prod. activos" value={productosActivos.length} icon="productos" color="#10b981" t={t}/>
      </div>

      {/* ── METAS ── */}
      <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <h3 style={{margin:"0 0 3px",fontSize:16,fontWeight:800,color:t.text}}>🎯 Mis Metas</h3>
            <p style={{margin:0,fontSize:12,color:t.sub}}>Seguí tu progreso hacia tus objetivos</p>
          </div>
          <button onClick={()=>setEditandoMeta(e=>!e)} style={{background:editandoMeta?t.accent:"none",border:`1px solid ${t.accent}`,color:editandoMeta?"#fff":t.accent,borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <Icon name="edit" size={13}/>{editandoMeta?"Cerrar":"Editar metas"}
          </button>
        </div>

        {editandoMeta&&(
          <div style={{background:t.bg,borderRadius:10,padding:"16px 18px",marginBottom:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:5,textTransform:"uppercase"}}>Meta de ganancia ($)</label>
              <input type="number" value={meta.ganancia} onChange={e=>setMeta(m=>({...m,ganancia:e.target.value}))} placeholder="Ej: 3000000" style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div>
              <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:5,textTransform:"uppercase"}}>Meta de nuevos clientes</label>
              <input type="number" value={meta.clientes} onChange={e=>setMeta(m=>({...m,clientes:e.target.value}))} placeholder="Ej: 10" style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <div style={{gridColumn:"1/-1",display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={()=>setEditandoMeta(false)} style={{padding:"8px 16px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600,fontSize:12}}>Cancelar</button>
              <button onClick={()=>{setMetaGuardada({ganancia:+meta.ganancia||0,clientes:+meta.clientes||0});setEditandoMeta(false);}} style={{padding:"8px 16px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,fontSize:12}}>Guardar metas</button>
            </div>
          </div>
        )}

        {metaGuardada.ganancia===0&&metaGuardada.clientes===0?(
          <div style={{textAlign:"center",padding:"20px 0",color:t.sub}}>
            <div style={{fontSize:28,marginBottom:8}}>🎯</div>
            <div style={{fontSize:13,color:t.sub}}>Tocá <strong style={{color:t.accent}}>"Editar metas"</strong> para definir tus objetivos de ganancia y clientes</div>
          </div>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {/* META GANANCIA */}
            {metaGuardada.ganancia>0&&(()=>{
              const actual=ganReal;
              const pct=Math.min(100,Math.round((actual/metaGuardada.ganancia)*100));
              const falta=Math.max(0,metaGuardada.ganancia-actual);
              const color=pct>=100?"#10b981":pct>=50?"#3b82f6":"#f59e0b";
              return(
                <div style={{background:t.bg,borderRadius:12,padding:"18px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Meta de ganancia</div>
                      <div style={{fontSize:20,fontWeight:900,color:t.text}}>{fmt(metaGuardada.ganancia)}</div>
                    </div>
                    <div style={{width:48,height:48,borderRadius:"50%",background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column"}}>
                      <div style={{fontSize:13,fontWeight:900,color}}>{pct}%</div>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11}}>
                      <span style={{color:t.sub}}>Ganado: <strong style={{color}}>{fmt(actual)}</strong></span>
                      <span style={{color:t.sub}}>Falta: <strong style={{color:"#ef4444"}}>{fmt(falta)}</strong></span>
                    </div>
                    <div style={{height:12,borderRadius:6,background:t.border,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${color},${color}cc)`,borderRadius:6,transition:"width 0.7s"}}/>
                    </div>
                  </div>
                  {pct>=100?(
                    <div style={{fontSize:12,color:"#10b981",fontWeight:700,textAlign:"center"}}>🎉 ¡Meta cumplida!</div>
                  ):(
                    <div style={{fontSize:11,color:t.sub,textAlign:"center"}}>Te faltan <strong style={{color:t.text}}>{fmt(falta)}</strong> para llegar</div>
                  )}
                </div>
              );
            })()}
            {/* META CLIENTES */}
            {metaGuardada.clientes>0&&(()=>{
              const actual=clients.length;
              const pct=Math.min(100,Math.round((actual/metaGuardada.clientes)*100));
              const falta=Math.max(0,metaGuardada.clientes-actual);
              const color=pct>=100?"#10b981":pct>=50?"#8b5cf6":"#f59e0b";
              return(
                <div style={{background:t.bg,borderRadius:12,padding:"18px 20px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                    <div>
                      <div style={{fontSize:11,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Meta de clientes</div>
                      <div style={{fontSize:20,fontWeight:900,color:t.text}}>{metaGuardada.clientes} clientes</div>
                    </div>
                    <div style={{width:48,height:48,borderRadius:"50%",background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <div style={{fontSize:13,fontWeight:900,color}}>{pct}%</div>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:11}}>
                      <span style={{color:t.sub}}>Actuales: <strong style={{color}}>{actual}</strong></span>
                      <span style={{color:t.sub}}>Falta: <strong style={{color:"#ef4444"}}>{falta}</strong></span>
                    </div>
                    <div style={{height:12,borderRadius:6,background:t.border,overflow:"hidden"}}>
                      <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${color},${color}cc)`,borderRadius:6,transition:"width 0.7s"}}/>
                    </div>
                  </div>
                  {pct>=100?(
                    <div style={{fontSize:12,color:"#10b981",fontWeight:700,textAlign:"center"}}>🎉 ¡Meta cumplida!</div>
                  ):(
                    <div style={{fontSize:11,color:t.sub,textAlign:"center"}}>Te faltan <strong style={{color:t.text}}>{falta} cliente{falta!==1?"s":""}</strong> para llegar</div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
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
            <div onClick={()=>setShowCobros(true)} style={{background:"#10b98118",borderRadius:12,padding:"14px 18px",border:"1px solid #10b98130",cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="#10b98128"}
              onMouseLeave={e=>e.currentTarget.style.background="#10b98118"}>
              <div style={{fontSize:10,color:"#10b981",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Ya cobrado 👆</div>
              <div style={{fontSize:20,fontWeight:900,color:"#10b981"}}>{fmt(totalCobradoReal)}</div>
              <div style={{fontSize:11,color:t.sub,marginTop:2}}>Tocá para ver historial</div>
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

      {/* PANEL HISTORIAL DE COBROS */}
      {showCobros&&(
        <div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"stretch"}}>
          <div onClick={()=>setShowCobros(false)} style={{flex:1,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(3px)",cursor:"pointer"}}/>
          <div style={{width:"min(580px,95vw)",background:t.bg,overflowY:"auto",boxShadow:"-8px 0 40px rgba(0,0,0,0.35)",display:"flex",flexDirection:"column"}}>
            {/* Header */}
            <div style={{background:t.card,borderBottom:`1px solid ${t.border}`,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,zIndex:10}}>
              <div>
                <div style={{fontSize:17,fontWeight:800,color:t.text}}>💰 Historial de cobros</div>
                <div style={{fontSize:12,color:t.sub,marginTop:2}}>Total cobrado: <strong style={{color:"#10b981"}}>{fmt(totalCobradoReal)}</strong></div>
              </div>
              <button onClick={()=>setShowCobros(false)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"6px 14px",cursor:"pointer",color:t.sub,fontSize:13,fontWeight:600}}>✕ Cerrar</button>
            </div>
            <div style={{padding:"18px",flex:1}}>
              {(()=>{
                // Recopilar todos los pagos de todos los créditos
                const pagos=[];
                creditos.forEach(c=>{
                  (c.detalleCuotas||[]).forEach(d=>{
                    if(d.estado==="Pagada"&&d.montoPagado>0){
                      pagos.push({
                        cliente:c.clienteNombre,
                        tipo:"Crédito",
                        cuota:d.num,
                        monto:d.montoPagado,
                        fechaPago:d.fechaPago||"—",
                        fechaVenc:d.fechaVenc,
                        anticipo:d.valorCuotaEditado&&d.montoPagado<(d.valorCuotaEditado||c.valorCuota),
                        mora:d.valorCuotaEditado&&d.montoPagado>(c.valorCuota),
                      });
                    }
                  });
                });
                productos.forEach(p=>{
                  (p.detalleCuotas||[]).forEach(d=>{
                    if(d.estado==="Pagada"&&d.montoPagado>0){
                      pagos.push({
                        cliente:p.clienteNombre,
                        tipo:"Venta",
                        cuota:d.num,
                        monto:d.montoPagado,
                        fechaPago:d.fechaPago||"—",
                        fechaVenc:d.fechaVenc,
                        anticipo:false,mora:false,
                      });
                    }
                  });
                });
                ventasContado.forEach(v=>{
                  pagos.push({
                    cliente:v.cliente_nombre||"—",
                    tipo:"Contado",
                    cuota:null,
                    monto:v.precio_venta,
                    fechaPago:fmtFecha(v.fecha),
                    fechaVenc:null,
                    anticipo:false,mora:false,
                    producto:v.producto,
                  });
                });

                // Ordenar por fecha de pago más reciente
                pagos.sort((a,b)=>{
                  const fa=a.fechaPago&&a.fechaPago!=="—"?a.fechaPago.split("/").reverse().join("-"):"";
                  const fb=b.fechaPago&&b.fechaPago!=="—"?b.fechaPago.split("/").reverse().join("-"):"";
                  return fb.localeCompare(fa);
                });

                if(pagos.length===0)return(
                  <div style={{textAlign:"center",padding:"60px 0",color:t.sub}}>
                    <div style={{fontSize:40,marginBottom:12}}>💸</div>
                    <div style={{fontSize:14}}>No hay cobros registrados todavía</div>
                  </div>
                );

                // Agrupar por fecha
                const porFecha={};
                pagos.forEach(p=>{
                  const key=p.fechaPago||"Sin fecha";
                  if(!porFecha[key])porFecha[key]=[];
                  porFecha[key].push(p);
                });

                return Object.entries(porFecha).map(([fecha,ps])=>(
                  <div key={fecha} style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>📅 {fecha}</span>
                      <span style={{color:"#10b981",fontWeight:800}}>{fmt(ps.reduce((s,p)=>s+p.monto,0))}</span>
                    </div>
                    <div style={{display:"grid",gap:8}}>
                      {ps.map((p,i)=>(
                        <div key={i} style={{background:t.card,borderRadius:10,padding:"12px 16px",border:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <div>
                            <div style={{fontWeight:700,color:t.text,fontSize:13}}>{p.cliente}</div>
                            <div style={{fontSize:11,color:t.sub,marginTop:2,display:"flex",gap:8,flexWrap:"wrap"}}>
                              <span style={{background:p.tipo==="Crédito"?"#dbeafe":p.tipo==="Venta"?"#d1fae5":"#fef3c7",color:p.tipo==="Crédito"?"#1e40af":p.tipo==="Venta"?"#065f46":"#92400e",padding:"1px 7px",borderRadius:20,fontWeight:600,fontSize:10}}>{p.tipo}</span>
                              {p.cuota&&<span>Cuota {p.cuota}</span>}
                              {p.producto&&<span>{p.producto}</span>}
                              {p.anticipo&&<span style={{color:"#8b5cf6",fontWeight:600}}>🎁 Con descuento</span>}
                              {p.mora&&<span style={{color:"#f59e0b",fontWeight:600}}>⚠️ Con mora</span>}
                            </div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:16,fontWeight:900,color:"#10b981"}}>{fmt(p.monto)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
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
                <div style={{fontSize:32,marginBottom:8}}>{tabPagos==="aldia"?"✅":tabPagos==="vencido"?"⏰":"🎉"}</div>
                <div style={{fontSize:13,fontWeight:600,color:t.text}}>
                  {tabPagos==="aldia"?"Ningún cliente paga hoy ni en los próximos 3 días":tabPagos==="vencido"?"No hay pagos vencidos":"No hay clientes morosos"}
                </div>
              </div>
            ):(
              <div style={{display:"grid",gap:8}}>
                {listaActiva.map(c=>{
                  const clienteInfo=clients.find(cl=>cl.id===c.clienteId);
                  const abierto=clienteExpandido===c.clienteId;
                  const diffLabel=c.diffDias===0?"Vence HOY":c.diffDias>0?`Vence en ${c.diffDias} día${c.diffDias!==1?"s":""}`:c.diffDias===-1?"Venció ayer":`Venció hace ${Math.abs(c.diffDias)} días`;
                  const nVencidas=c.cuotasVencidas?.length||0;
                  return(
                    <div key={`${c._tipo||"credito"}-${c.id}`} style={{borderRadius:10,border:`1px solid ${tabActiva.border}`,overflow:"hidden"}}>
                      <div onClick={()=>setClienteExpandido(abierto?null:c.clienteId)}
                        style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:tabActiva.bg,cursor:"pointer",flexWrap:"wrap",gap:10}}>
                        <div style={{display:"flex",alignItems:"center",gap:12}}>
                          <div style={{width:40,height:40,borderRadius:"50%",background:tabActiva.color,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:15,flexShrink:0}}>
                            {(c.clienteNombre||"?")[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{fontWeight:700,color:t.text,fontSize:14,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              {c.clienteNombre}
                              {c._tipo==="producto"
                                ?<span style={{fontSize:10,background:"#8b5cf6",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>🛒 {c._etiqueta||"Venta"}</span>
                                :<span style={{fontSize:10,background:"#3b82f6",color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>💳 Crédito</span>}
                              {nVencidas>0&&<span style={{fontSize:10,background:tabActiva.color,color:"#fff",borderRadius:20,padding:"1px 7px",fontWeight:700}}>{nVencidas} vencida{nVencidas!==1?"s":""}</span>}
                            </div>
                            <div style={{fontSize:11,color:t.sub,display:"flex",gap:12,flexWrap:"wrap",marginTop:2}}>
                              <span>Próx. cuota: <strong style={{color:t.text}}>{fmt(c.proxCuota?.valorCuotaEditado||c.valorCuota)}</strong></span>
                              <span>Saldo: <strong style={{color:tabActiva.color}}>{fmt(c.saldoPendiente)}</strong></span>
                              <span>{c.frecuencia}</span>
                              <span style={{fontWeight:700,color:tabActiva.color}}>{diffLabel}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8,alignItems:"center"}}>
                          {/* BOTÓN COBRADO — funciona para créditos Y productos */}
                          <button onClick={async e=>{
                            e.stopPropagation();
                            if(!window.confirm(`¿Marcar cuota de ${fmt(c.proxCuota?.valorCuotaEditado||c.valorCuota)} como pagada?`))return;
                            const det=[...(c.detalleCuotas||[])];
                            const idx=det.findIndex(d=>d.estado==="Pendiente"||d.estado==="Parcial");
                            if(idx===-1)return;
                            const vc=det[idx].valorCuotaEditado||c.valorCuota;
                            det[idx]={...det[idx],montoPagado:vc,estado:"Pagada",fechaPago:new Date().toLocaleDateString("es-AR")};
                            const totalCobrado=det.reduce((s,d)=>s+d.montoPagado,0);
                            const nuevoTotal=det.reduce((s,d)=>s+(d.valorCuotaEditado||c.valorCuota),0);
                            const pendiente=Math.max(0,nuevoTotal-totalCobrado);
                            const pagadas=det.filter(d=>d.estado==="Pagada").length;
                            const prox=det.find(d=>d.estado!=="Pagada");
                            const nuevoEstado=pendiente<=0?"Finalizado":"Al día";
                            const tabla=c._tipo==="producto"?"productos":"creditos";
                            const updateData={cuotas_pagadas:pagadas,saldo_cobrado:totalCobrado,saldo_pendiente:pendiente,proximo_pago:prox?.fechaVenc||"",estado:nuevoEstado,detalle_cuotas:det};
                            if(c._tipo!=="producto")updateData.historial=[...(c.historial||[]),{tipo:"pago_completo",cuota:idx+1,monto:vc,fecha:new Date().toLocaleDateString("es-AR")}];
                            await sb.from(tabla).update(updateData).eq("id",c.id);
                            if(c._tipo==="producto"){
                              setProductos(ps=>ps.map(x=>x.id===c.id?{...x,cuotasPagadas:pagadas,saldoCobrado:totalCobrado,saldoPendiente:pendiente,proximoPago:prox?.fechaVenc||"",estado:nuevoEstado,detalleCuotas:det}:x));
                            } else {
                              setCreditos(cs=>cs.map(x=>x.id===c.id?{...x,cuotasPagadas:pagadas,saldoCobrado:totalCobrado,saldoPendiente:pendiente,proximoPago:prox?.fechaVenc||"",estado:nuevoEstado,detalleCuotas:det}:x));
                            }
                          }} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                            ✓ Cobrado
                          </button>
                          {clienteInfo?.tel&&(
                            <button onClick={e=>abrirMensaje(c,clienteInfo,e)}
                              style={{display:"flex",alignItems:"center",gap:5,background:"#25D366",color:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,fontWeight:700,border:"none",cursor:"pointer"}}>
                              <Icon name="whatsapp" size={13}/>{mensajeEditando===c.clienteId?"Cerrar":"WA"}
                            </button>
                          )}
                          <div style={{color:t.sub,fontSize:11,textAlign:"right"}}>
                            <div>{c.cuotasPagadas}/{c.cuotas} cuotas</div>
                            <div style={{color:tabActiva.color}}>{abierto?"▲ Ocultar":"▼ Ver cuotas"}</div>
                          </div>
                        </div>
                      </div>
                      {/* Panel de mensaje editable */}
                      {mensajeEditando===c.clienteId&&clienteInfo?.tel&&(
                        <div onClick={e=>e.stopPropagation()} style={{background:t.card,borderTop:`2px solid #25D366`,padding:"14px 16px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:"#25D366",textTransform:"uppercase",marginBottom:8}}>✏️ Editá el mensaje antes de enviar</div>
                          <textarea
                            value={getMensaje(c,clienteInfo)}
                            onChange={e=>setMensajeTexto(m=>({...m,[c.clienteId]:e.target.value}))}
                            rows={4}
                            style={{width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid #25D36640`,background:t.bg,color:t.text,fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",lineHeight:1.5}}
                          />
                          <div style={{display:"flex",gap:8,marginTop:10,justifyContent:"space-between",alignItems:"center"}}>
                            <button onClick={e=>{e.stopPropagation();const nombre=clienteInfo?.nombre||c.clienteNombre?.split(" ")[0]||"cliente";setMensajeTexto(m=>({...m,[c.clienteId]:`Hola ${nombre}, ¿cómo estás? Te escribía el día de hoy por el pago pactado.`}));}}
                              style={{fontSize:11,color:t.sub,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
                              Restablecer mensaje
                            </button>
                            <div style={{display:"flex",gap:8}}>
                              <button onClick={e=>{e.stopPropagation();setMensajeEditando(null);}} style={{padding:"8px 14px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontSize:12,fontWeight:600}}>Cancelar</button>
                              <button onClick={e=>enviarWA(clienteInfo.tel,getMensaje(c,clienteInfo),e)}
                                style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,border:"none",background:"#25D366",color:"#fff",cursor:"pointer",fontSize:12,fontWeight:700}}>
                                <Icon name="whatsapp" size={14}/>Abrir WhatsApp
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {abierto&&(
                        <div style={{background:t.card,borderTop:`1px solid ${tabActiva.border}`,padding:"14px 16px"}}>
                          <div style={{fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",marginBottom:10}}>Cuotas del crédito</div>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead><tr style={{background:t.bg}}>{["#","Vencimiento","Valor","Pagado","Saldo","Estado"].map(h=><th key={h} style={{padding:"6px 10px",textAlign:"left",fontSize:10,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                            <tbody>
                              {(c.detalleCuotas||[]).map((d,i)=>{
                                const vc=d.valorCuotaEditado||c.valorCuota;
                                const saldo=Math.max(0,vc-d.montoPagado);
                                const estaVencida=d.fechaVenc&&new Date(d.fechaVenc)<hoy&&d.estado!=="Pagada";
                                const colEst=d.estado==="Pagada"?"#10b981":d.estado==="Parcial"?"#f59e0b":estaVencida?"#ef4444":"#64748b";
                                return(
                                  <tr key={i} style={{borderTop:`1px solid ${t.border}`,background:estaVencida?"#fee2e215":"transparent"}}>
                                    <td style={{padding:"7px 10px",fontWeight:700,color:t.text}}>{d.num}</td>
                                    <td style={{padding:"7px 10px",color:estaVencida?"#ef4444":t.text,fontWeight:estaVencida?700:400}}>{fmtFecha(d.fechaVenc)}{estaVencida&&<span style={{fontSize:9,marginLeft:4,color:"#ef4444",fontWeight:700}}>VENCIDA</span>}</td>
                                    <td style={{padding:"7px 10px",color:t.text}}>{fmt(vc)}{d.valorCuotaEditado&&d.valorCuotaEditado!==c.valorCuota&&<span style={{fontSize:9,color:"#f59e0b",marginLeft:3}}>+mora</span>}</td>
                                    <td style={{padding:"7px 10px",color:d.montoPagado>0?"#10b981":t.sub,fontWeight:d.montoPagado>0?700:400}}>{fmt(d.montoPagado)}</td>
                                    <td style={{padding:"7px 10px",color:saldo>0?"#ef4444":"#10b981",fontWeight:700}}>{fmt(saldo)}</td>
                                    <td style={{padding:"7px 10px"}}><span style={{color:colEst,fontWeight:600,fontSize:11}}>{d.estado}</span>{d.fechaPago&&<div style={{fontSize:9,color:t.sub}}>{d.fechaPago}</div>}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── PROYECCIÓN FUTURA 6 MESES ── */}
      {(creditos.length>0||productos.length>0)&&(()=>{
        const hoyP=new Date();
        const meses=Array.from({length:6},(_,i)=>{
          const d=new Date(hoyP.getFullYear(),hoyP.getMonth()+i,1);
          return{label:["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]+" "+(d.getFullYear()+"").slice(2),desde:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`,hasta:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${new Date(d.getFullYear(),d.getMonth()+1,0).getDate()}`};
        });
        const dataProy=meses.map(m=>{
          let proyCred=0;
          creditos.filter(c=>c.estado!=="Finalizado").forEach(c=>{(c.detalleCuotas||[]).filter(d=>d.estado!=="Pagada"&&d.fechaVenc>=m.desde&&d.fechaVenc<=m.hasta).forEach(d=>{proyCred+=d.valorCuotaEditado||c.valorCuota||0;});});
          let proyProd=0;
          productosActivos.forEach(p=>{(p.detalleCuotas||[]).filter(d=>d.estado!=="Pagada"&&d.fechaVenc>=m.desde&&d.fechaVenc<=m.hasta).forEach(d=>{proyProd+=d.valorCuotaEditado||p.valorCuota||0;});});
          return{name:m.label,creditos:proyCred,productos:proyProd,total:proyCred+proyProd};
        });
        const maxVal=Math.max(...dataProy.map(d=>d.total),1);
        const totalProy6=dataProy.reduce((s,d)=>s+d.total,0);
        return(
          <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 24px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:8}}>
              <div><h3 style={{margin:"0 0 3px",fontSize:16,fontWeight:800,color:t.text}}>📈 Proyección de cobros — próximos 6 meses</h3><p style={{margin:0,fontSize:12,color:t.sub}}>Basado en cuotas pendientes en el cronograma</p></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:20,fontWeight:900,color:t.accent}}>{fmt(totalProy6)}</div><div style={{fontSize:11,color:t.sub}}>total proyectado 6 meses</div></div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",height:160,marginBottom:12}}>
              {dataProy.map((d,i)=>{
                const esActual=i===0;
                return(
                  <div key={d.name} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,height:"100%",justifyContent:"flex-end"}}>
                    <div style={{fontSize:10,color:t.text,fontWeight:700,marginBottom:2}}>{d.total>0?fmt(d.total).replace(/\.000$/,"k"):""}</div>
                    <div style={{width:"100%",display:"flex",flexDirection:"column",gap:1,borderRadius:"4px 4px 0 0",overflow:"hidden"}}>
                      {d.productos>0&&<div style={{height:`${(d.productos/maxVal)*130}px`,background:"#10b981",minHeight:d.productos>0?4:0}}/>}
                      {d.creditos>0&&<div style={{height:`${(d.creditos/maxVal)*130}px`,background:esActual?"#f59e0b":"#3b82f6",minHeight:d.creditos>0?4:0}}/>}
                    </div>
                    <div style={{fontSize:11,color:esActual?t.accent:t.sub,fontWeight:esActual?700:400,whiteSpace:"nowrap"}}>{d.name}</div>
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:16,fontSize:11,color:t.sub,justifyContent:"center"}}>
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#3b82f6",display:"inline-block"}}/> Créditos</span>
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#10b981",display:"inline-block"}}/> Ventas financiadas</span>
              <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:2,background:"#f59e0b",display:"inline-block"}}/> Mes actual</span>
            </div>
          </div>
        );
      })()}

      {/* ── RANKING RENTABILIDAD POR CLIENTE ── */}
      {clients.length>0&&(()=>{
        const ranking=clients.map(cl=>{
          const crs=creditos.filter(c=>c.clienteId===cl.id);
          const prds=productos.filter(p=>p.clienteId===cl.id);
          const ganReal=crs.reduce((s,c)=>s+c.saldoCobrado-(c.monto/c.cuotas*c.cuotasPagadas),0)+prds.reduce((s,p)=>s+p.saldoCobrado-(p.inversion/p.cuotas*p.cuotasPagadas),0);
          const ganEsp=crs.reduce((s,c)=>s+c.ganancia,0)+prds.reduce((s,p)=>s+p.ganancia,0);
          const totalPrestado=crs.reduce((s,c)=>s+c.monto,0)+prds.reduce((s,p)=>s+p.inversion,0);
          const rentPct=totalPrestado>0?Math.round((ganEsp/totalPrestado)*100):0;
          const deudaActiva=crs.filter(c=>c.estado!=="Finalizado").reduce((s,c)=>s+c.saldoPendiente,0)+prds.filter(p=>p.estado!=="Finalizado").reduce((s,p)=>s+p.saldoPendiente,0);
          return{...cl,ganReal,ganEsp,totalPrestado,rentPct,deudaActiva,nOps:crs.length+prds.length};
        }).filter(cl=>cl.nOps>0);
        if(ranking.length===0)return null;
        const rankOrdenado=[...ranking].sort((a,b)=>{
          if(ordenRank==="ganEsp")return b.ganEsp-a.ganEsp;
          if(ordenRank==="ganReal")return b.ganReal-a.ganReal;
          if(ordenRank==="rentPct")return b.rentPct-a.rentPct;
          if(ordenRank==="totalPrestado")return b.totalPrestado-a.totalPrestado;
          return 0;
        }).slice(0,10);
        const maxGan=Math.max(...rankOrdenado.map(r=>r.ganEsp),1);
        return(
          <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"20px 24px",marginBottom:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div><h3 style={{margin:"0 0 3px",fontSize:16,fontWeight:800,color:t.text}}>🏆 Ranking de clientes por rentabilidad</h3><p style={{margin:0,fontSize:12,color:t.sub}}>Top 10 clientes que más ganancia te generan</p></div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{id:"ganEsp",label:"Gan. esperada"},{id:"ganReal",label:"Gan. realizada"},{id:"rentPct",label:"Rentab. %"},{id:"totalPrestado",label:"Capital"}].map(op=>(
                  <button key={op.id} onClick={()=>setOrdenRank(op.id)} style={{padding:"5px 10px",borderRadius:7,border:`1px solid ${ordenRank===op.id?t.accent:t.border}`,background:ordenRank===op.id?`${t.accent}20`:"transparent",color:ordenRank===op.id?t.accent:t.sub,fontWeight:ordenRank===op.id?700:400,fontSize:11,cursor:"pointer"}}>{op.label}</button>
                ))}
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {rankOrdenado.map((cl,i)=>{
                const barW=maxGan>0?Math.round((cl.ganEsp/maxGan)*100):0;
                const av=`hsl(${(cl.id*67)%360},55%,55%)`;
                const medalla=i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`;
                return(
                  <div key={cl.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:t.bg,borderRadius:10,border:`1px solid ${i===0?"#f59e0b30":t.border}`}}>
                    <div style={{fontSize:i<3?18:13,fontWeight:700,color:i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#cd7c2f":t.sub,minWidth:24,textAlign:"center"}}>{medalla}</div>
                    <div style={{width:34,height:34,borderRadius:"50%",background:av,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:13,flexShrink:0}}>{cl.nombre[0]}{cl.apellido[0]}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:4}}>
                        <span style={{fontWeight:700,color:t.text,fontSize:13}}>{cl.nombre} {cl.apellido}</span>
                        <div style={{display:"flex",gap:12,fontSize:11,flexShrink:0}}>
                          <span style={{color:"#8b5cf6",fontWeight:700}}>Esp: {fmt(cl.ganEsp)}</span>
                          <span style={{color:"#10b981",fontWeight:700}}>Real: {fmt(cl.ganReal)}</span>
                          <span style={{color:"#f59e0b",fontWeight:700}}>{cl.rentPct}%</span>
                        </div>
                      </div>
                      <div style={{height:6,borderRadius:3,background:t.border,overflow:"hidden"}}><div style={{width:`${barW}%`,height:"100%",background:i===0?"linear-gradient(90deg,#f59e0b,#10b981)":i<3?"linear-gradient(90deg,#8b5cf6,#3b82f6)":"#3b82f6",borderRadius:3}}/></div>
                      <div style={{fontSize:10,color:t.sub,marginTop:3,display:"flex",gap:10,flexWrap:"wrap"}}>
                        <span>Capital: {fmt(cl.totalPrestado)}</span><span>{cl.nOps} op{cl.nOps!==1?"s":""}</span>
                        {cl.deudaActiva>0&&<span style={{color:"#ef4444"}}>Deuda: {fmt(cl.deudaActiva)}</span>}
                        {cl.estado==="Moroso"&&<span style={{color:"#ef4444",fontWeight:700}}>⚠️ Moroso</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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

const Clientes=({clients,setClients,creditos,setCreditos,productos,usuarioActual,soloVer=false,t})=>{
  const [search,setSearch]=useState("");
  const [filtro,setFiltro]=useState("Todos");
  const [modal,setModal]=useState(false);
  const [perfil,setPerfil]=useState(null);
  const [sel,setSel]=useState(null);
  const [loading,setLoading]=useState(false);
  const [scanLoading,setScanLoading]=useState(false);
  const dniRef=useRef();
  const EF={nombre:"",apellido:"",dni:"",email:"",tel:"",ciudad:"",provincia:"",estado:"Al día",sueldo:"",ocupacion:"",empresa:"",estadoCivil:"Soltero/a",nacimiento:"",score:75,notas:"",direccion:"",mapsLink:""};
  const [form,setForm]=useState(EF);
  const filtered=clients.filter(c=>{const q=search.toLowerCase();return(c.nombre.toLowerCase().includes(q)||c.apellido.toLowerCase().includes(q)||(c.dni||"").includes(q))&&(filtro==="Todos"||c.estado===filtro);});
  const openEdit=(c,e)=>{if(e)e.stopPropagation();setSel(c);setForm({...EF,...c});setModal(true);};

  // Escanear DNI con Claude Vision
  const escanearDNI=async(file)=>{
    setScanLoading(true);
    try{
      const toBase64=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});
      const b64=await toBase64(file);
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:500,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:b64}},
            {type:"text",text:`Analizá esta imagen de un DNI argentino y extraé los datos. Respondé SOLO con un JSON sin texto extra ni backticks con estos campos exactos:
{"nombre":"","apellido":"","dni":"","nacimiento":"YYYY-MM-DD","sexo":""}
Si no encontrás algún dato dejalo vacío. El DNI son solo los números sin puntos.`}
          ]}]
        })
      });
      const data=await resp.json();
      const txt=data.content?.[0]?.text||"{}";
      const clean=txt.replace(/```json|```/g,"").trim();
      const parsed=JSON.parse(clean);
      setForm(f=>({
        ...f,
        nombre:parsed.nombre||f.nombre,
        apellido:parsed.apellido||f.apellido,
        dni:parsed.dni||f.dni,
        nacimiento:parsed.nacimiento||f.nacimiento,
        estadoCivil:parsed.sexo==="F"?"Soltero/a":parsed.sexo==="M"?"Soltero/a":f.estadoCivil,
      }));
      alert("✅ Datos del DNI cargados. Revisalos antes de guardar.");
    }catch(err){
      alert("No se pudo leer el DNI automáticamente. Cargá los datos manualmente.");
    }
    setScanLoading(false);
  };

  const save=async()=>{
    if(!form.nombre)return;
    setLoading(true);
    const data={nombre:form.nombre,apellido:form.apellido,dni:form.dni,email:form.email,tel:form.tel,ciudad:form.ciudad,provincia:form.provincia,estado:form.estado,score:+form.score||75,sueldo:+form.sueldo||null,ocupacion:form.ocupacion,empresa:form.empresa,estado_civil:form.estadoCivil,nacimiento:form.nacimiento,notas:form.notas,usuario_id:usuarioActual?.id||0,direccion:form.direccion||"",maps_link:form.mapsLink||""};
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
    if(window.confirm("¿Eliminar cliente?")) {
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
        {!soloVer&&<button onClick={()=>{setSel(null);setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nuevo cliente</button>}
        {soloVer&&<span style={{background:"#fef3c7",color:"#92400e",padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600}}>👁 Solo lectura</span>}
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
                <td style={{padding:"12px 15px"}}><div style={{display:"flex",gap:6}}>
                    {!soloVer&&<button onClick={e=>openEdit(c,e)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:t.sub}}><Icon name="edit" size={14}/></button>}
                    {!soloVer&&<button onClick={e=>{e.stopPropagation();generatePDFCliente(c,creditos,productos);}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#3b82f6"}} title="Exportar PDF del cliente"><Icon name="pdf" size={14}/></button>}
                    {soloVer&&<button onClick={e=>{e.stopPropagation();generatePDFCliente(c,creditos,productos);}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#3b82f6"}}><Icon name="pdf" size={14}/></button>}
                    {!soloVer&&<button onClick={e=>del(c.id,e)} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#ef4444"}}><Icon name="trash" size={14}/></button>}
                  </div></td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length===0&&<div style={{padding:"40px",textAlign:"center",color:t.sub}}>No se encontraron clientes</div>}
        </div>
      )}
      <Modal open={modal} onClose={()=>setModal(false)} title={sel?"Editar cliente":"Nuevo cliente"} t={t} wide>
        {/* BOTÓN ESCANEAR DNI */}
        {!sel&&(
          <div style={{background:`${t.accent}10`,border:`1px dashed ${t.accent}40`,borderRadius:10,padding:"14px 16px",marginBottom:18,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:t.accent,marginBottom:2}}>📷 Escanear DNI automáticamente</div>
              <div style={{fontSize:11,color:t.sub}}>Sacá una foto del DNI frente y se completan los datos solos</div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <input ref={dniRef} type="file" accept="image/*" capture="environment" onChange={e=>e.target.files[0]&&escanearDNI(e.target.files[0])} style={{display:"none"}}/>
              <button onClick={()=>dniRef.current.click()} disabled={scanLoading}
                style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                {scanLoading?"⏳ Leyendo DNI...":"📷 Foto DNI"}
              </button>
              <button onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=e=>e.target.files[0]&&escanearDNI(e.target.files[0]);inp.click();}} disabled={scanLoading}
                style={{background:"none",border:`1px solid ${t.accent}`,color:t.accent,borderRadius:8,padding:"9px 14px",fontWeight:600,fontSize:12,cursor:"pointer"}}>
                🖼 Galería
              </button>
            </div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <Field label="Nombre *" value={form.nombre} onChange={v=>setForm(f=>({...f,nombre:v}))} t={t}/>
          <Field label="Apellido *" value={form.apellido} onChange={v=>setForm(f=>({...f,apellido:v}))} t={t}/>
          <Field label="DNI (opcional)" value={form.dni} onChange={v=>setForm(f=>({...f,dni:v}))} t={t}/>
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
          <div style={{gridColumn:"1/-1"}}><Field label="Dirección del domicilio" value={form.direccion||""} onChange={v=>setForm(f=>({...f,direccion:v}))} t={t} placeholder="Ej: San Martín 1234, Piso 2"/></div>
          <div style={{gridColumn:"1/-1",marginBottom:14}}>
            <label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:4,textTransform:"uppercase"}}>Link Google Maps (opcional)</label>
            <input value={form.mapsLink||""} onChange={e=>setForm(f=>({...f,mapsLink:e.target.value}))} placeholder="Pegá el link de Google Maps del domicilio" style={{width:"100%",padding:"9px 12px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
            {form.mapsLink&&<a href={form.mapsLink} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:t.accent,marginTop:4,display:"inline-block"}}>🗺 Ver en Maps</a>}
          </div>
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
const Creditos=({creditos,setCreditos,clients,usuarioActual,soloVer=false,t})=>{
  const [search,setSearch]=useState("");
  const [filtroEst,setFiltroEst]=useState("Todos");
  const [modal,setModal]=useState(false);
  const [editModal,setEditModal]=useState(false);
  const [creditoEditando,setCreditoEditando]=useState(null);
  const [expandido,setExpandido]=useState(null);
  const [loading,setLoading]=useState(false);
  const EF={clienteId:"",monto:"",totalCobrar:"",cuotas:"",frecuencia:"Mensual",fechaOtorg:new Date().toISOString().slice(0,10),estado:"Al día",comentarios:""};
  const [form,setForm]=useState(EF);
  const [formEdit,setFormEdit]=useState({monto:"",totalCobrar:"",cuotas:"",frecuencia:"Mensual",estado:"Al día",comentarios:""});
  const filtered=creditos.filter(c=>{const q=search.toLowerCase();return(c.clienteNombre.toLowerCase().includes(q)||c.estado.toLowerCase().includes(q))&&(filtroEst==="Todos"||c.estado===filtroEst);});
  const vc=form.cuotas&&form.totalCobrar?Math.round(+form.totalCobrar/+form.cuotas):0;
  const gan=form.monto&&form.totalCobrar?+form.totalCobrar-+form.monto:0;
  const prox=generarFechasCuotas(form.fechaOtorg,form.frecuencia,1)[0]||"";

  const abrirEdicion=(c)=>{
    setCreditoEditando(c);
    setFormEdit({monto:c.monto,totalCobrar:c.totalCobrar,cuotas:c.cuotas,frecuencia:c.frecuencia,estado:c.estado,comentarios:c.comentarios||""});
    setEditModal(true);
  };

  const guardarEdicion=async()=>{
    if(!creditoEditando)return;
    setLoading(true);
    const nuevoVC=Math.round(+formEdit.totalCobrar/+formEdit.cuotas);
    const nuevaGanancia=+formEdit.totalCobrar-+formEdit.monto;
    // Recalcular saldo pendiente manteniendo lo ya cobrado
    const nuevoPendiente=Math.max(0,+formEdit.totalCobrar-creditoEditando.saldoCobrado);
    // Regenerar cuotas si cambiaron cantidad o frecuencia
    const cambioEstructura=+formEdit.cuotas!==creditoEditando.cuotas||formEdit.frecuencia!==creditoEditando.frecuencia;
    let nuevasDet=creditoEditando.detalleCuotas||[];
    if(cambioEstructura){
      nuevasDet=crearDetalleCuotas(creditoEditando.fechaOtorg,formEdit.frecuencia,+formEdit.cuotas,nuevoVC);
      // Marcar cuotas ya pagadas
      for(let i=0;i<Math.min(creditoEditando.cuotasPagadas,nuevasDet.length);i++){
        nuevasDet[i]={...nuevasDet[i],estado:"Pagada",montoPagado:nuevoVC,fechaPago:new Date().toLocaleDateString("es-AR")};
      }
    } else {
      // Solo actualizar valor cuota en las pendientes
      nuevasDet=nuevasDet.map(d=>d.estado==="Pendiente"?{...d,valorCuotaEditado:undefined}:d);
    }
    const proxPendiente=nuevasDet.find(d=>d.estado!=="Pagada");
    const data={
      monto:+formEdit.monto,total_cobrar:+formEdit.totalCobrar,ganancia:nuevaGanancia,
      cuotas:+formEdit.cuotas,valor_cuota:nuevoVC,saldo_pendiente:nuevoPendiente,
      frecuencia:formEdit.frecuencia,estado:formEdit.estado,comentarios:formEdit.comentarios,
      proximo_pago:proxPendiente?.fechaVenc||creditoEditando.proximoPago,
      detalle_cuotas:nuevasDet,
      historial:[...creditoEditando.historial,{tipo:"edicion_credito",fecha:new Date().toLocaleDateString("es-AR"),cambios:`Monto: ${fmt(+formEdit.monto)}, Total: ${fmt(+formEdit.totalCobrar)}, Cuotas: ${formEdit.cuotas}`}]
    };
    await sb.from("creditos").update(data).eq("id",creditoEditando.id);
    setCreditos(cs=>cs.map(c=>c.id===creditoEditando.id?{...c,...creditoFromDB({...c,...{id:c.id,cliente_id:c.clienteId,cliente_nombre:c.clienteNombre,monto:+formEdit.monto,total_cobrar:+formEdit.totalCobrar,ganancia:nuevaGanancia,cuotas:+formEdit.cuotas,cuotas_pagadas:c.cuotasPagadas,valor_cuota:nuevoVC,saldo_cobrado:c.saldoCobrado,saldo_pendiente:nuevoPendiente,frecuencia:formEdit.frecuencia,fecha_otorg:c.fechaOtorg,proximo_pago:proxPendiente?.fechaVenc||c.proximoPago,estado:formEdit.estado,comentarios:formEdit.comentarios,historial:data.historial,detalle_cuotas:nuevasDet}})}:c));
    setLoading(false);setEditModal(false);setCreditoEditando(null);
  };

  const save=async()=>{
    if(!form.clienteId||!form.monto||!form.totalCobrar||!form.cuotas)return;
    const client=clients.find(c=>c.id===+form.clienteId);if(!client)return;
    setLoading(true);
    const v=Math.round(+form.totalCobrar/+form.cuotas);
    const det=crearDetalleCuotas(form.fechaOtorg,form.frecuencia,+form.cuotas,v);
    const data={cliente_id:+form.clienteId,cliente_nombre:`${client.nombre} ${client.apellido}`,monto:+form.monto,total_cobrar:+form.totalCobrar,ganancia:+form.totalCobrar-+form.monto,cuotas:+form.cuotas,cuotas_pagadas:0,valor_cuota:v,saldo_cobrado:0,saldo_pendiente:+form.totalCobrar,frecuencia:form.frecuencia,fecha_otorg:form.fechaOtorg,proximo_pago:det[0]?.fechaVenc||"",estado:form.estado,comentarios:form.comentarios,historial:[],detalle_cuotas:det,usuario_id:usuarioActual?.id||0};
    const {data:created}=await sb.from("creditos").insert(data).select().single();
    if(created)setCreditos(cs=>[...cs,creditoFromDB(created)]);
    setLoading(false);setModal(false);
  };

  const actualizarCredito=async(cred)=>{
    await sb.from("creditos").update({cuotas_pagadas:cred.cuotasPagadas,saldo_cobrado:cred.saldoCobrado,saldo_pendiente:cred.saldoPendiente,proximo_pago:cred.proximoPago,estado:cred.estado,historial:cred.historial,detalle_cuotas:cred.detalleCuotas}).eq("id",cred.id);
    setCreditos(cs=>cs.map(c=>c.id===cred.id?cred:c));
  };

  const eliminar=async(id)=>{
    if(window.confirm("¿Eliminar este crédito? Se guardará en la papelera por 24 horas.")){
      const credito=creditos.find(c=>c.id===id);
      if(credito){
        // Guardar en papelera antes de eliminar
        await sb.from("papelera").insert({tipo:"credito",datos:credito,eliminado_por:usuarioActual?.nombre||"admin"});
      }
      await sb.from("creditos").delete().eq("id",id);
      setCreditos(cs=>cs.filter(c=>c.id!==id));
    }
  };



  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:22}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Créditos & Préstamos</h1><p style={{color:t.sub,margin:0,fontSize:13}}>{creditos.filter(c=>c.estado!=="Finalizado").length} activos · {creditos.length} totales</p></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>exportarExcelCreditos(creditos,clients)} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>📊 Exportar Excel</button>
          {!soloVer&&<button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nuevo crédito</button>}
          {soloVer&&<span style={{background:"#fef3c7",color:"#92400e",padding:"6px 14px",borderRadius:8,fontSize:12,fontWeight:600,display:"flex",alignItems:"center"}}>👁 Solo lectura</span>}
        </div>
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
                      {!soloVer&&<button onClick={()=>abrirEdicion(c)} style={{background:"none",border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}} title="Editar crédito"><Icon name="edit" size={13}/></button>}
                      <button onClick={()=>generatePDF(c)} style={{background:"none",border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Icon name="pdf" size={13}/></button>
                      {!soloVer&&<UploadBtn label={c.pagareUrl?"📄 Pagaré ✓":"📄 Pagaré"} url={c.pagareUrl} accept="image/*,.pdf" color={c.pagareUrl?"#10b981":"#f59e0b"} t={t} onUpload={async(url)=>{await sb.from("creditos").update({pagare_url:url}).eq("id",c.id);setCreditos(cs=>cs.map(x=>x.id===c.id?{...x,pagareUrl:url}:x));}}/>}
                      {!soloVer&&<button onClick={()=>eliminar(c.id)} style={{background:"none",border:"1px solid #fca5a5",color:"#ef4444",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>}
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
          <div style={{gridColumn:"1/-1"}}><ClienteBuscador clients={clients} t={t} onSelect={c=>setForm(f=>({...f,clienteId:c?c.id:""}))}/></div>
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

      {/* MODAL EDITAR CRÉDITO */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title={`Editar crédito — ${creditoEditando?.clienteNombre}`} t={t}>
        {creditoEditando&&(
          <div>
            <div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:12,color:t.sub}}>
              Ya cobrado: <strong style={{color:t.accent2}}>{fmt(creditoEditando.saldoCobrado)}</strong> — 
              Cuotas pagadas: <strong style={{color:t.text}}>{creditoEditando.cuotasPagadas}/{creditoEditando.cuotas}</strong>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <Field label="Monto prestado ($)" value={formEdit.monto} onChange={v=>setFormEdit(f=>({...f,monto:v}))} type="number" t={t}/>
              <Field label="Total a cobrar ($)" value={formEdit.totalCobrar} onChange={v=>setFormEdit(f=>({...f,totalCobrar:v}))} type="number" t={t}/>
              <Field label="Cantidad de cuotas" value={formEdit.cuotas} onChange={v=>setFormEdit(f=>({...f,cuotas:v}))} type="number" t={t}/>
              <Field label="Frecuencia" value={formEdit.frecuencia} onChange={v=>setFormEdit(f=>({...f,frecuencia:v}))} options={FRECUENCIAS} t={t}/>
              <Field label="Estado" value={formEdit.estado} onChange={v=>setFormEdit(f=>({...f,estado:v}))} options={["Al día","Pendiente","Atrasado","Moroso","Refinanciado","Finalizado"]} t={t}/>
            </div>
            {formEdit.monto&&formEdit.totalCobrar&&formEdit.cuotas&&(
              <div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Nueva cuota</div><div style={{fontSize:16,fontWeight:800,color:t.accent}}>{fmt(Math.round(+formEdit.totalCobrar/+formEdit.cuotas))}</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Nueva ganancia</div><div style={{fontSize:16,fontWeight:800,color:t.accent2}}>{fmt(+formEdit.totalCobrar-+formEdit.monto)}</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Nuevo pendiente</div><div style={{fontSize:16,fontWeight:800,color:"#ef4444"}}>{fmt(Math.max(0,+formEdit.totalCobrar-creditoEditando.saldoCobrado))}</div></div>
              </div>
            )}
            {+formEdit.cuotas!==creditoEditando.cuotas&&<div style={{background:"#fef3c7",borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#92400e",fontWeight:600}}>⚠️ Al cambiar la cantidad de cuotas se va a regenerar el cronograma manteniendo las cuotas ya pagadas.</div>}
            <Field label="Comentarios" value={formEdit.comentarios} onChange={v=>setFormEdit(f=>({...f,comentarios:v}))} t={t}/>
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Guardar cambios"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
const Productos=({productos,setProductos,ventasContado,setVentasContado,clients,usuarioActual,soloVer=false,t})=>{
  const [modal,setModal]=useState(false);
  const [modalContado,setModalContado]=useState(false);
  const [editModal,setEditModal]=useState(false);
  const [productoEditando,setProductoEditando]=useState(null);
  const [tabActiva,setTabActiva]=useState("financiado");
  const [expandido,setExpandido]=useState(null);
  const [loading,setLoading]=useState(false);
  const [searchProd,setSearchProd]=useState("");
  const [filtroEstProd,setFiltroEstProd]=useState("Todos");
  const EF={clienteId:"",producto:"",inversion:"",precioFinanciado:"",cuotas:"",frecuencia:"Mensual",estado:"Activo",fechaOtorg:new Date().toISOString().slice(0,10),entrega:""};
  const [form,setForm]=useState(EF);
  const EFC={producto:"",clienteNombre:"",costo:"",precioVenta:"",fecha:new Date().toISOString().slice(0,10),notas:""};
  const [formC,setFormC]=useState(EFC);
  const [formEdit,setFormEdit]=useState({inversion:"",precioFinanciado:"",cuotas:"",frecuencia:"Mensual",estado:"Activo"});

  const saveContado=async()=>{
    if(!formC.producto||!formC.costo||!formC.precioVenta)return;
    setLoading(true);
    const ganancia=+formC.precioVenta-+formC.costo;
    const data={producto:formC.producto,cliente_nombre:formC.clienteNombre,costo:+formC.costo,precio_venta:+formC.precioVenta,ganancia,fecha:formC.fecha,notas:formC.notas,usuario_id:usuarioActual?.id||0};
    const {data:created}=await sb.from("ventas_contado").insert(data).select().single();
    if(created)setVentasContado(vs=>[...vs,created]);
    setLoading(false);setModalContado(false);setFormC(EFC);
  };

  const delContado=async(id)=>{
    if(window.confirm("¿Eliminar esta venta?")){ await sb.from("ventas_contado").delete().eq("id",id); setVentasContado(vs=>vs.filter(v=>v.id!==id)); }
  };

  const save=async()=>{
    if(!form.clienteId||!form.producto||!form.inversion||!form.cuotas)return;
    const client=clients.find(c=>c.id===+form.clienteId);
    if(!client)return;
    setLoading(true);
    const vc=Math.round(+form.precioFinanciado/+form.cuotas);
    const det=crearDetalleCuotas(form.fechaOtorg,form.frecuencia,+form.cuotas,vc);
    const entregaN=+form.entrega||0;const vc2=Math.round(+form.precioFinanciado/+form.cuotas);const det2=crearDetalleCuotas(form.fechaOtorg,form.frecuencia,+form.cuotas,vc2);const data={cliente_id:+form.clienteId,cliente_nombre:`${client.nombre} ${client.apellido}`,producto:form.producto,inversion:+form.inversion,precio_financiado:+form.precioFinanciado,ganancia:+form.precioFinanciado-+form.inversion,cuotas:+form.cuotas,cuotas_pagadas:0,saldo_cobrado:0,saldo_pendiente:+form.precioFinanciado,valor_cuota:vc2,estado:form.estado,frecuencia:form.frecuencia,usuario_id:usuarioActual?.id||0,detalle_cuotas:det2,fecha_otorg:form.fechaOtorg,proximo_pago:det2[0]?.fechaVenc||"",entrega:entregaN};
    const {data:created}=await sb.from("productos").insert(data).select().single();
    if(created)setProductos(ps=>[...ps,productoFromDB(created)]);
    setLoading(false);setModal(false);setForm(EF);
  };

  const del=async(id)=>{
    if(window.confirm("¿Eliminar esta venta? Se guardará en la papelera por 24 horas.")){
      const producto=productos.find(p=>p.id===id);
      if(producto) await sb.from("papelera").insert({tipo:"producto",datos:producto,eliminado_por:usuarioActual?.nombre||"admin"});
      await sb.from("productos").delete().eq("id",id);
      setProductos(ps=>ps.filter(p=>p.id!==id));
    }
  };

  const abrirEdicion=(p)=>{
    setProductoEditando(p);
    setFormEdit({inversion:p.inversion,precioFinanciado:p.precioFinanciado,cuotas:p.cuotas,frecuencia:p.frecuencia,estado:p.estado});
    setEditModal(true);
  };

  const guardarEdicion=async()=>{
    if(!productoEditando)return;
    setLoading(true);
    const nuevoVC=Math.round(+formEdit.precioFinanciado/+formEdit.cuotas);
    const nuevaGan=+formEdit.precioFinanciado-+formEdit.inversion;
    const cobrado=productoEditando.saldoCobrado||0;
    const pendiente=Math.max(0,+formEdit.precioFinanciado-cobrado);
    const cambioEst=+formEdit.cuotas!==productoEditando.cuotas||formEdit.frecuencia!==productoEditando.frecuencia;
    let det=productoEditando.detalleCuotas||[];
    if(cambioEst){
      det=crearDetalleCuotas(productoEditando.fechaOtorg||new Date().toISOString().slice(0,10),formEdit.frecuencia,+formEdit.cuotas,nuevoVC);
      for(let i=0;i<Math.min(productoEditando.cuotasPagadas,det.length);i++){
        det[i]={...det[i],estado:"Pagada",montoPagado:nuevoVC,fechaPago:new Date().toLocaleDateString("es-AR")};
      }
    }
    const prox=det.find(d=>d.estado!=="Pagada");
    await sb.from("productos").update({inversion:+formEdit.inversion,precio_financiado:+formEdit.precioFinanciado,ganancia:nuevaGan,cuotas:+formEdit.cuotas,valor_cuota:nuevoVC,saldo_pendiente:pendiente,frecuencia:formEdit.frecuencia,estado:formEdit.estado,detalle_cuotas:det,proximo_pago:prox?.fechaVenc||""}).eq("id",productoEditando.id);
    setProductos(ps=>ps.map(p=>p.id===productoEditando.id?{...p,inversion:+formEdit.inversion,precioFinanciado:+formEdit.precioFinanciado,ganancia:nuevaGan,cuotas:+formEdit.cuotas,valorCuota:nuevoVC,saldoPendiente:pendiente,frecuencia:formEdit.frecuencia,estado:formEdit.estado,detalleCuotas:det,proximoPago:prox?.fechaVenc||""}:p));
    setLoading(false);setEditModal(false);setProductoEditando(null);
  };

  const actualizarProducto=async(prod)=>{
    await sb.from("productos").update({cuotas_pagadas:prod.cuotasPagadas,saldo_cobrado:prod.saldoCobrado,saldo_pendiente:prod.saldoPendiente,proximo_pago:prod.proximoPago,estado:prod.estado,detalle_cuotas:prod.detalleCuotas}).eq("id",prod.id);
    setProductos(ps=>ps.map(p=>p.id===prod.id?prod:p));
  };

  const gananciaContado=ventasContado.reduce((s,v)=>s+v.ganancia,0);

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
        <div><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 2px"}}>Productos</h1><p style={{color:t.sub,margin:0,fontSize:13}}>{productos.filter(p=>p.estado!=="Finalizado").length} financiados activos · {ventasContado.length} contado</p></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>exportarExcelProductos(productos,ventasContado)} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"10px 16px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>📊 Exportar Excel</button>
          {tabActiva==="financiado"?<button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nueva venta financiada</button>
          :<button onClick={()=>{setFormC(EFC);setModalContado(true);}} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"10px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}><Icon name="plus" size={15}/>Nueva venta contado</button>}
        </div>
      </div>

      <div style={{display:"flex",gap:0,borderBottom:`1px solid ${t.border}`,marginBottom:20}}>
        {[{id:"financiado",label:"💳 Venta Financiada",color:"#3b82f6"},{id:"contado",label:"💵 Venta de Contado",color:"#10b981"}].map(tab=>(
          <button key={tab.id} onClick={()=>setTabActiva(tab.id)}
            style={{padding:"10px 22px",border:"none",borderBottom:tabActiva===tab.id?`3px solid ${tab.color}`:"3px solid transparent",background:"transparent",cursor:"pointer",fontWeight:tabActiva===tab.id?700:500,fontSize:13,color:tabActiva===tab.id?tab.color:t.sub,transition:"all 0.15s"}}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* VENTA FINANCIADA — con buscador igual a créditos */}
      {tabActiva==="financiado"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:18,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200,position:"relative"}}>
              <input value={searchProd} onChange={e=>setSearchProd(e.target.value)} placeholder="Buscar por cliente o producto..." style={{width:"100%",padding:"10px 14px 10px 40px",borderRadius:10,border:`1px solid ${t.border}`,background:t.card,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/>
              <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:t.sub}}><Icon name="search" size={16}/></span>
            </div>
            {["Todos","Activo","Atrasado","Moroso","Finalizado"].map(f=><button key={f} onClick={()=>setFiltroEstProd(f)} style={{padding:"8px 13px",borderRadius:8,border:`1px solid ${filtroEstProd===f?t.accent:t.border}`,background:filtroEstProd===f?t.accent:"transparent",color:filtroEstProd===f?"#fff":t.sub,fontWeight:600,fontSize:12,cursor:"pointer"}}>{f}</button>)}
          </div>
          {(()=>{
            const filtrados=productos.filter(p=>{
              const q=searchProd.toLowerCase();
              return(p.clienteNombre.toLowerCase().includes(q)||p.producto.toLowerCase().includes(q))&&(filtroEstProd==="Todos"||p.estado===filtroEstProd);
            });
            if(productos.length===0)return<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"60px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🛒</div><div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No hay ventas financiadas</div><button onClick={()=>{setForm(EF);setModal(true);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",marginTop:10}}>+ Nueva venta</button></div>;
            if(filtrados.length===0)return<div style={{padding:"40px",textAlign:"center",color:t.sub}}>No se encontraron ventas</div>;
            return(
          <div style={{display:"grid",gap:14}}>
            {filtrados.map(p=>{
              const pct=Math.round((p.cuotasPagadas/p.cuotas)*100);
              const exp=expandido===p.id;
              return(
                <div key={p.id} style={{background:t.card,borderRadius:14,border:`1px solid ${p.estado==="Moroso"?"#fca5a5":p.estado==="Atrasado"?"#fcd34d":t.border}`,overflow:"hidden"}}>
                  <div style={{padding:"18px 22px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                      <div style={{flex:1,minWidth:200}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                          <span style={{fontSize:15,fontWeight:700,color:t.text}}>{p.producto}</span>
                          <Badge status={p.estado}/>
                          <span style={{fontSize:11,color:t.sub,background:t.bg,padding:"2px 8px",borderRadius:6,fontWeight:600}}>{p.frecuencia}</span>
                        </div>
                        <div style={{fontSize:12,color:t.sub,marginBottom:4}}>{p.clienteNombre}</div>
                        <div style={{display:"flex",gap:18,flexWrap:"wrap"}}>
                          <span style={{fontSize:12,color:t.sub}}>Inversión: <strong style={{color:t.text}}>{fmt(p.inversion)}</strong></span>
                          <span style={{fontSize:12,color:t.sub}}>Financiado: <strong style={{color:t.text}}>{fmt(p.precioFinanciado)}</strong></span>
                          <span style={{fontSize:12,color:t.sub}}>Cobrado: <strong style={{color:t.accent2}}>{fmt(p.saldoCobrado)}</strong></span>
                          <span style={{fontSize:12,color:t.sub}}>Pendiente: <strong style={{color:"#ef4444"}}>{fmt(p.saldoPendiente)}</strong></span>
                          <span style={{fontSize:12,color:t.sub}}>Cuota: <strong style={{color:t.text}}>{fmt(p.valorCuota)}</strong></span>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                        <button onClick={()=>setExpandido(exp?null:p.id)} style={{background:exp?t.accent:"none",border:`1px solid ${t.accent}`,color:exp?"#fff":t.accent,borderRadius:8,padding:"7px 12px",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",gap:4}}><Icon name="calendar" size={13}/>{exp?"Ocultar":"Ver cuotas"}</button>
                        <button onClick={()=>abrirEdicion(p)} style={{background:"none",border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}} title="Editar"><Icon name="edit" size={13}/></button>
                        <button onClick={()=>generatePDF({...p,clienteNombre:p.clienteNombre,monto:p.inversion,totalCobrar:p.precioFinanciado,valorCuota:p.valorCuota,saldoCobrado:p.saldoCobrado,saldoPendiente:p.saldoPendiente,cuotasPagadas:p.cuotasPagadas,cuotas:p.cuotas,fechaOtorg:p.fechaOtorg,proximoPago:p.proximoPago,frecuencia:p.frecuencia,estado:p.estado,detalleCuotas:p.detalleCuotas||[]})} style={{background:"none",border:`1px solid ${t.border}`,color:t.sub,borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:3}}><Icon name="pdf" size={13}/></button>
                        <button onClick={()=>del(p.id)} style={{background:"none",border:"1px solid #fca5a5",color:"#ef4444",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>
                      </div>
                    </div>
                    <div style={{marginTop:14}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:11,color:t.sub}}>{p.cuotasPagadas}/{p.cuotas} cuotas</span><span style={{fontSize:11,fontWeight:700,color:t.text}}>{pct}%</span></div>
                      <div style={{height:7,borderRadius:4,background:t.border,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:pct>=100?t.accent2:pct>50?t.accent:"#f59e0b",borderRadius:4,transition:"width 0.5s"}}/></div>
                    </div>
                  </div>
                  {exp&&<div style={{borderTop:`1px solid ${t.border}`,padding:"16px 22px",background:t.bg}}>
                    <div style={{fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase",marginBottom:10}}>Cronograma de cuotas</div>
                    {(!p.detalleCuotas||p.detalleCuotas.length===0)?(
                      <div style={{textAlign:"center",padding:"16px"}}>
                        <div style={{fontSize:13,color:t.sub,marginBottom:10}}>Sin cuotas generadas</div>
                        <button onClick={async()=>{
                          const vc=p.valorCuota||Math.round(p.precioFinanciado/p.cuotas);
                          const det=crearDetalleCuotas(p.fechaOtorg||new Date().toISOString().slice(0,10),p.frecuencia,p.cuotas,vc);
                          await sb.from("productos").update({detalle_cuotas:det}).eq("id",p.id);
                          actualizarProducto({...p,detalleCuotas:det});
                        }} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer"}}>✨ Generar cuotas</button>
                      </div>
                    ):(
                      <TablaCuotas credito={{...p,monto:p.inversion,totalCobrar:p.precioFinanciado,valorCuota:p.valorCuota,historial:[]}} onActualizar={actualizarProducto} t={t}/>
                    )}
                  </div>}
                </div>
              );
            })}
          </div>
            );
          })()}
        </div>
      )}

      {/* VENTA DE CONTADO */}
      {tabActiva==="contado"&&(
        <div>
          {ventasContado.length>0&&(
            <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:12,padding:"14px 18px",marginBottom:16,display:"flex",gap:24,alignItems:"center"}}>
              <div><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Total ventas</div><div style={{fontSize:18,fontWeight:800,color:t.text}}>{ventasContado.length}</div></div>
              <div><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Ganancia total</div><div style={{fontSize:18,fontWeight:800,color:"#10b981"}}>{fmt(gananciaContado)}</div></div>
              <div><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:2}}>Inversión total</div><div style={{fontSize:18,fontWeight:800,color:t.text}}>{fmt(ventasContado.reduce((s,v)=>s+v.costo,0))}</div></div>
            </div>
          )}
          {ventasContado.length===0?<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"60px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>💵</div><div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>No hay ventas de contado</div><button onClick={()=>{setFormC(EFC);setModalContado(true);}} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"10px 20px",fontWeight:700,cursor:"pointer",marginTop:10}}>+ Nueva venta contado</button></div>:(
            <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,overflow:"hidden"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr style={{background:t.bg}}>{["Producto","Cliente","Costo","Precio venta","Ganancia","Rentab.","Fecha",""].map(h=><th key={h} style={{padding:"11px 15px",textAlign:"left",fontSize:11,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead>
                <tbody>
                  {ventasContado.map(v=>{
                    const rent=v.costo>0?Math.round((v.ganancia/v.costo)*100):0;
                    return(
                      <tr key={v.id} style={{borderTop:`1px solid ${t.border}`}}>
                        <td style={{padding:"12px 15px",fontWeight:700,color:t.text}}>{v.producto}</td>
                        <td style={{padding:"12px 15px",color:t.sub,fontSize:13}}>{v.cliente_nombre||"—"}</td>
                        <td style={{padding:"12px 15px",color:t.text,fontSize:13}}>{fmt(v.costo)}</td>
                        <td style={{padding:"12px 15px",color:t.text,fontSize:13,fontWeight:700}}>{fmt(v.precio_venta)}</td>
                        <td style={{padding:"12px 15px",color:"#10b981",fontSize:13,fontWeight:800}}>{fmt(v.ganancia)}</td>
                        <td style={{padding:"12px 15px"}}><span style={{background:"#8b5cf620",color:"#8b5cf6",padding:"2px 8px",borderRadius:20,fontSize:12,fontWeight:700}}>{rent}%</span></td>
                        <td style={{padding:"12px 15px",color:t.sub,fontSize:12}}>{fmtFecha(v.fecha)}</td>
                        <td style={{padding:"12px 15px"}}><button onClick={()=>delContado(v.id)} style={{background:"none",border:"1px solid #fca5a5",borderRadius:6,padding:"5px 8px",cursor:"pointer",color:"#ef4444"}}><Icon name="trash" size={13}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL NUEVA VENTA FINANCIADA */}
      <Modal open={modal} onClose={()=>setModal(false)} title="Nueva venta financiada" t={t}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1"}}><ClienteBuscador clients={clients} t={t} onSelect={c=>setForm(f=>({...f,clienteId:c?c.id:""}))}/></div>
          <div style={{gridColumn:"1/-1"}}><Field label="Producto *" value={form.producto} onChange={v=>setForm(f=>({...f,producto:v}))} t={t} placeholder="Ej: iPhone 15, Heladera..."/></div>
          <Field label="Tu inversión ($) *" value={form.inversion} onChange={v=>setForm(f=>({...f,inversion:v}))} type="number" t={t}/>
          <Field label="Precio financiado ($)" value={form.precioFinanciado} onChange={v=>setForm(f=>({...f,precioFinanciado:v}))} type="number" t={t}/>
          <Field label="Cuotas *" value={form.cuotas} onChange={v=>setForm(f=>({...f,cuotas:v}))} type="number" t={t}/>
          <Field label="Frecuencia" value={form.frecuencia} onChange={v=>setForm(f=>({...f,frecuencia:v}))} options={FRECUENCIAS} t={t}/>
          <Field label="Fecha otorgamiento" value={form.fechaOtorg} onChange={v=>setForm(f=>({...f,fechaOtorg:v}))} type="date" t={t}/>
          <Field label="Entrega / Adelanto ($)" value={form.entrega} onChange={v=>setForm(f=>({...f,entrega:v}))} type="number" t={t} placeholder="0 si no hay adelanto"/>
          <Field label="Estado" value={form.estado} onChange={v=>setForm(f=>({...f,estado:v}))} options={["Activo","Atrasado","Moroso"]} t={t}/>
        </div>
        {form.inversion&&form.precioFinanciado&&form.cuotas&&<div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Cuota</div><div style={{fontSize:16,fontWeight:800,color:t.accent}}>{fmt(Math.round(+form.precioFinanciado/+form.cuotas))}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Ganancia</div><div style={{fontSize:16,fontWeight:800,color:t.accent2}}>{fmt(+form.precioFinanciado-+form.inversion)}</div></div>
          <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Rentab.</div><div style={{fontSize:16,fontWeight:800,color:"#8b5cf6"}}>{Math.round(((+form.precioFinanciado-+form.inversion)/(+form.inversion||1))*100)}%</div></div>
          {+form.entrega>0&&<div style={{gridColumn:"1/-1",textAlign:"center",background:"#10b98115",borderRadius:8,padding:"8px",fontSize:12,color:"#10b981",fontWeight:600}}>
            ✓ Entrega registrada: {fmt(+form.entrega)} (solo informativo — no afecta las cuotas)
          </div>}
        </div>}
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={save} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Crear venta"}</button>
        </div>
      </Modal>

      {/* MODAL EDITAR VENTA */}
      <Modal open={editModal} onClose={()=>setEditModal(false)} title={`Editar — ${productoEditando?.producto}`} t={t}>
        {productoEditando&&(
          <div>
            <div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:12,color:t.sub}}>
              Ya cobrado: <strong style={{color:t.accent2}}>{fmt(productoEditando.saldoCobrado)}</strong> · Cuotas pagadas: <strong>{productoEditando.cuotasPagadas}/{productoEditando.cuotas}</strong>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
              <Field label="Inversión ($)" value={formEdit.inversion} onChange={v=>setFormEdit(f=>({...f,inversion:v}))} type="number" t={t}/>
              <Field label="Precio financiado ($)" value={formEdit.precioFinanciado} onChange={v=>setFormEdit(f=>({...f,precioFinanciado:v}))} type="number" t={t}/>
              <Field label="Cuotas" value={formEdit.cuotas} onChange={v=>setFormEdit(f=>({...f,cuotas:v}))} type="number" t={t}/>
              <Field label="Frecuencia" value={formEdit.frecuencia} onChange={v=>setFormEdit(f=>({...f,frecuencia:v}))} options={FRECUENCIAS} t={t}/>
              <Field label="Estado" value={formEdit.estado} onChange={v=>setFormEdit(f=>({...f,estado:v}))} options={["Activo","Atrasado","Moroso","Finalizado"]} t={t}/>
            </div>
            {formEdit.precioFinanciado&&formEdit.cuotas&&<div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Nueva cuota</div><div style={{fontSize:16,fontWeight:800,color:t.accent}}>{fmt(Math.round(+formEdit.precioFinanciado/+formEdit.cuotas))}</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Nueva ganancia</div><div style={{fontSize:16,fontWeight:800,color:t.accent2}}>{fmt(+formEdit.precioFinanciado-+formEdit.inversion)}</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:10,color:t.sub,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Nuevo pendiente</div><div style={{fontSize:16,fontWeight:800,color:"#ef4444"}}>{fmt(Math.max(0,+formEdit.precioFinanciado-productoEditando.saldoCobrado))}</div></div>
            </div>}
            <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditModal(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:t.accent,color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Guardar"}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL NUEVA VENTA CONTADO */}
      <Modal open={modalContado} onClose={()=>setModalContado(false)} title="Nueva venta de contado" t={t}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px"}}>
          <div style={{gridColumn:"1/-1"}}><Field label="Producto *" value={formC.producto} onChange={v=>setFormC(f=>({...f,producto:v}))} t={t} placeholder="Ej: iPhone 14..."/></div>
          <div style={{gridColumn:"1/-1"}}><Field label="Nombre del cliente (opcional)" value={formC.clienteNombre} onChange={v=>setFormC(f=>({...f,clienteNombre:v}))} t={t}/></div>
          <Field label="Costo ($) *" value={formC.costo} onChange={v=>setFormC(f=>({...f,costo:v}))} type="number" t={t}/>
          <Field label="Precio de venta ($) *" value={formC.precioVenta} onChange={v=>setFormC(f=>({...f,precioVenta:v}))} type="number" t={t}/>
          <Field label="Fecha" value={formC.fecha} onChange={v=>setFormC(f=>({...f,fecha:v}))} type="date" t={t}/>
        </div>
        {formC.costo&&formC.precioVenta&&<div style={{background:t.bg,borderRadius:10,padding:"12px 16px",marginBottom:14,fontSize:12,display:"flex",gap:20}}>
          <span>Ganancia: <strong style={{color:"#10b981",fontSize:15}}>{fmt(+formC.precioVenta-+formC.costo)}</strong></span>
          <span>Rentabilidad: <strong style={{color:"#8b5cf6"}}>{Math.round(((+formC.precioVenta-+formC.costo)/(+formC.costo||1))*100)}%</strong></span>
        </div>}
        <Field label="Notas" value={formC.notas} onChange={v=>setFormC(f=>({...f,notas:v}))} t={t}/>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
          <button onClick={()=>setModalContado(false)} style={{padding:"9px 18px",borderRadius:8,border:`1px solid ${t.border}`,background:"none",color:t.sub,cursor:"pointer",fontWeight:600}}>Cancelar</button>
          <button onClick={saveContado} disabled={loading} style={{padding:"9px 18px",borderRadius:8,border:"none",background:"#10b981",color:"#fff",cursor:"pointer",fontWeight:700,opacity:loading?0.7:1}}>{loading?"Guardando...":"Registrar"}</button>
        </div>
      </Modal>
    </div>
  );
};


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

// ── PRESUPUESTO ───────────────────────────────────────────────────────────────
const Presupuesto=({t})=>{
  const [monto,setMonto]=useState("");
  const [porcentaje,setPorcentaje]=useState("25");
  const [cuotas,setCuotas]=useState("4");
  const [frecuencia,setFrecuencia]=useState("Semanal");
  const [tipo,setTipo]=useState("Crédito");
  const [tablaFrancesa,setTablaFrancesa]=useState(false);
  const [guardados,setGuardados]=useState(()=>{try{return JSON.parse(localStorage.getItem("cc_presupuestos")||"[]");}catch{return[];}});
  const [nombreGuardar,setNombreGuardar]=useState("");
  const [guardandoNombre,setGuardandoNombre]=useState(false);
  const montoN=+monto||0;const pctN=+porcentaje||0;const cuotasN=+cuotas||1;
  const interes=montoN*(pctN/100);const totalCobrar=montoN+interes;const valorCuota=totalCobrar/cuotasN;
  const calcularTablaFrancesa=()=>{
    if(!montoN||!pctN||!cuotasN)return[];
    const hoy=new Date();const dias=frecuencia==="Semanal"?7:frecuencia==="Quincenal"?14:30;
    const tasaPeriodo=pctN/100/cuotasN;
    const cuotaFija=tasaPeriodo>0?montoN*tasaPeriodo/(1-Math.pow(1+tasaPeriodo,-cuotasN)):montoN/cuotasN;
    let saldo=montoN;
    return Array.from({length:cuotasN},(_,i)=>{
      const interesPeriodo=saldo*tasaPeriodo;const capitalPeriodo=cuotaFija-interesPeriodo;saldo=Math.max(0,saldo-capitalPeriodo);
      const d=new Date(hoy);d.setDate(hoy.getDate()+dias*(i+1));
      return{num:i+1,fecha:d.toLocaleDateString("es-AR"),cuota:cuotaFija,capital:capitalPeriodo,intereses:interesPeriodo,saldoRestante:saldo};
    });
  };
  const fechasCuotas=()=>{
    if(!montoN)return[];const hoy=new Date();const dias=frecuencia==="Semanal"?7:frecuencia==="Quincenal"?14:30;
    return Array.from({length:cuotasN},(_,i)=>{const d=new Date(hoy);d.setDate(hoy.getDate()+dias*(i+1));return{num:i+1,fecha:d.toLocaleDateString("es-AR"),valor:valorCuota};});
  };
  const cuotasDetalle=fechasCuotas();const cuotasFrancesas=calcularTablaFrancesa();const cuotaFrancesaFija=cuotasFrancesas[0]?.cuota||0;
  const generarPDF=()=>{
    if(!montoN||!pctN){alert("Ingresá el monto y el porcentaje");return;}
    const filas=tablaFrancesa
      ?cuotasFrancesas.map(c=>`<tr><td style="text-align:center;font-weight:700">${c.num}</td><td style="text-align:center">${c.fecha}</td><td style="text-align:center;font-weight:800;color:#1e40af">${fmt(c.cuota)}</td></tr>`).join("")
      :cuotasDetalle.map(c=>`<tr><td style="text-align:center;font-weight:700">${c.num}</td><td style="text-align:center">${c.fecha}</td><td style="text-align:center;font-weight:800;color:#1e40af">${fmt(c.valor)}</td></tr>`).join("");
    const html=`
      <div class="header"><div><div class="logo">Control<span>Credit</span></div><div class="subtitulo">Presupuesto de ${tipo} — ${tablaFrancesa?"Tabla Francesa":"Cuotas Fijas"}</div></div><div style="text-align:right"><div style="font-size:13px;font-weight:700">PRESUPUESTO</div><div style="font-size:11px;opacity:0.8">Fecha: ${new Date().toLocaleDateString("es-AR")}</div><div style="font-size:10px;opacity:0.7;margin-top:2px">Válido por 7 días</div></div></div>
      <div class="seccion"><div class="seccion-titulo">💰 Detalle del ${tipo}</div><div class="seccion-body" style="text-align:center"><div class="metrica"><div class="metrica-label">Cuotas</div><div class="metrica-valor">${cuotasN} cuota${cuotasN!==1?"s":""} ${frecuencia.toLowerCase()}${cuotasN!==1?"es":""}</div></div><div class="metrica"><div class="metrica-label">Valor por cuota</div><div class="metrica-valor" style="color:#10b981">${fmt(tablaFrancesa?cuotaFrancesaFija:valorCuota)}</div></div></div></div>
      <div class="seccion"><div class="seccion-titulo">📅 Cronograma de pagos</div><div class="seccion-body"><table><thead><tr style="background:#f8fafc"><th style="text-align:center;padding:10px">Cuota #</th><th style="text-align:center;padding:10px">Fecha de pago</th><th style="text-align:center;padding:10px">Monto</th></tr></thead><tbody>${filas}</tbody></table></div></div>
      <div style="background:#f0f9ff;border-left:4px solid #3b82f6;padding:14px 16px;font-size:12px;color:#1e40af;border-radius:0 8px 8px 0;margin-bottom:16px;line-height:1.6">📌 <strong>Condiciones:</strong> Este presupuesto es válido por 7 días desde la fecha de emisión. Los montos están expresados en pesos argentinos. El otorgamiento está sujeto a aprobación crediticia.</div>
      <div class="footer">ControlCredit &copy; ${new Date().getFullYear()} — Documento no válido como recibo de pago — Solo informativo</div>`;
    abrirPDF(html,"Presupuesto");
  };
  return(
    <div>
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 4px"}}>🧮 Calculadora de Presupuesto</h1><p style={{color:t.sub,margin:0,fontSize:13}}>Calculá cuotas y generá el PDF para enviar al cliente</p></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:20}}>
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"24px"}}>
          <h3 style={{margin:"0 0 18px",fontSize:15,fontWeight:700,color:t.text}}>Configurar presupuesto</h3>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:6,textTransform:"uppercase"}}>Tipo</label><div style={{display:"flex",gap:8}}>{["Crédito","Venta"].map(op=>(<button key={op} onClick={()=>setTipo(op)} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${tipo===op?t.accent:t.border}`,background:tipo===op?`${t.accent}15`:"transparent",color:tipo===op?t.accent:t.sub,fontWeight:tipo===op?700:500,fontSize:13,cursor:"pointer"}}>{op==="Crédito"?"💳 Crédito":"🛒 Venta"}</button>))}</div></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:6,textTransform:"uppercase"}}>Sistema de cuotas</label><div style={{display:"flex",gap:8}}><button onClick={()=>setTablaFrancesa(false)} style={{flex:1,padding:"10px 8px",borderRadius:8,border:`2px solid ${!tablaFrancesa?t.accent:t.border}`,background:!tablaFrancesa?`${t.accent}15`:"transparent",color:!tablaFrancesa?t.accent:t.sub,fontWeight:!tablaFrancesa?700:500,fontSize:12,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:16,marginBottom:2}}>📋</div><div>Cuotas fijas</div><div style={{fontSize:10,opacity:0.7,marginTop:2}}>Todas iguales</div></button><button onClick={()=>setTablaFrancesa(true)} style={{flex:1,padding:"10px 8px",borderRadius:8,border:`2px solid ${tablaFrancesa?"#8b5cf6":t.border}`,background:tablaFrancesa?"#8b5cf615":"transparent",color:tablaFrancesa?"#8b5cf6":t.sub,fontWeight:tablaFrancesa?700:500,fontSize:12,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:16,marginBottom:2}}>🏦</div><div>Tabla francesa</div><div style={{fontSize:10,opacity:0.7,marginTop:2}}>Capital + interés</div></button></div></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:6,textTransform:"uppercase"}}>Monto ($)</label><input type="number" value={monto} onChange={e=>setMonto(e.target.value)} placeholder="Ej: 100000" style={{width:"100%",padding:"10px 14px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:15,outline:"none",boxSizing:"border-box",fontWeight:600}}/></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:6,textTransform:"uppercase"}}>Interés / Porcentaje (%)</label><div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>{["10","15","20","25","30","40","50"].map(p=>(<button key={p} onClick={()=>setPorcentaje(p)} style={{padding:"6px 10px",borderRadius:7,border:`1px solid ${porcentaje===p?t.accent:t.border}`,background:porcentaje===p?t.accent:"transparent",color:porcentaje===p?"#fff":t.sub,fontWeight:600,fontSize:12,cursor:"pointer"}}>{p}%</button>))}</div><input type="number" value={porcentaje} onChange={e=>setPorcentaje(e.target.value)} placeholder="Ej: 25" style={{width:"100%",padding:"9px 14px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
          <div style={{marginBottom:16}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:6,textTransform:"uppercase"}}>Frecuencia de pago</label><div style={{display:"flex",gap:8}}>{["Semanal","Quincenal","Mensual"].map(f=>(<button key={f} onClick={()=>setFrecuencia(f)} style={{flex:1,padding:"9px 6px",borderRadius:8,border:`1px solid ${frecuencia===f?t.accent:t.border}`,background:frecuencia===f?`${t.accent}15`:"transparent",color:frecuencia===f?t.accent:t.sub,fontWeight:frecuencia===f?700:500,fontSize:12,cursor:"pointer"}}>{f}</button>))}</div></div>
          <div style={{marginBottom:20}}><label style={{display:"block",fontSize:11,fontWeight:700,color:t.sub,marginBottom:6,textTransform:"uppercase"}}>Cantidad de cuotas</label><div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>{["1","2","3","4","6","8","12"].map(c=>(<button key={c} onClick={()=>setCuotas(c)} style={{padding:"6px 10px",borderRadius:7,border:`1px solid ${cuotas===c?t.accent:t.border}`,background:cuotas===c?t.accent:"transparent",color:cuotas===c?"#fff":t.sub,fontWeight:600,fontSize:12,cursor:"pointer"}}>{c}</button>))}</div><input type="number" value={cuotas} onChange={e=>setCuotas(e.target.value)} placeholder="Ej: 4" style={{width:"100%",padding:"9px 14px",borderRadius:8,border:`1px solid ${t.inputBorder}`,background:t.input,color:t.text,fontSize:14,outline:"none",boxSizing:"border-box"}}/></div>
          <button onClick={generarPDF} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"#ef4444",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Icon name="pdf" size={18}/>Generar PDF del presupuesto</button>
          {montoN>0&&(<div style={{marginTop:12}}>{guardandoNombre?(<div style={{display:"flex",gap:8,alignItems:"center"}}><input value={nombreGuardar} onChange={e=>setNombreGuardar(e.target.value)} placeholder="Ej: Crédito 100k al 30%" autoFocus onKeyDown={e=>{if(e.key==="Enter"&&nombreGuardar.trim()){const nuevo={id:Date.now(),nombre:nombreGuardar.trim(),monto,porcentaje,cuotas,frecuencia,tipo,tablaFrancesa,fecha:new Date().toLocaleDateString("es-AR")};const nuevos=[nuevo,...guardados];setGuardados(nuevos);localStorage.setItem("cc_presupuestos",JSON.stringify(nuevos));setNombreGuardar("");setGuardandoNombre(false);}}} style={{flex:1,padding:"9px 12px",borderRadius:8,border:`1px solid ${t.accent}`,background:t.input,color:t.text,fontSize:13,outline:"none"}}/><button onClick={()=>{if(!nombreGuardar.trim())return;const nuevo={id:Date.now(),nombre:nombreGuardar.trim(),monto,porcentaje,cuotas,frecuencia,tipo,tablaFrancesa,fecha:new Date().toLocaleDateString("es-AR")};const nuevos=[nuevo,...guardados];setGuardados(nuevos);localStorage.setItem("cc_presupuestos",JSON.stringify(nuevos));setNombreGuardar("");setGuardandoNombre(false);}} style={{background:t.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 14px",fontWeight:700,fontSize:13,cursor:"pointer"}}>Guardar</button><button onClick={()=>{setGuardandoNombre(false);setNombreGuardar("");}} style={{background:"none",border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 10px",cursor:"pointer",color:t.sub}}><Icon name="close" size={14}/></button></div>):(<button onClick={()=>setGuardandoNombre(true)} style={{width:"100%",padding:"10px",borderRadius:10,border:`1px solid ${t.accent}`,background:"transparent",color:t.accent,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>💾 Guardar este presupuesto</button>)}</div>)}
        </div>
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><h3 style={{margin:0,fontSize:15,fontWeight:700,color:t.text}}>Vista previa</h3>{tablaFrancesa&&<span style={{background:"#8b5cf615",color:"#8b5cf6",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700}}>🏦 Tabla francesa</span>}</div>
          {!montoN?(<div style={{textAlign:"center",padding:"40px 0",color:t.sub}}><div style={{fontSize:40,marginBottom:12}}>🧮</div><div style={{fontSize:13}}>Ingresá el monto y el porcentaje para ver el presupuesto</div></div>):(<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              <div style={{background:t.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${t.border}`}}><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Monto</div><div style={{fontSize:17,fontWeight:900,color:t.text}}>{fmt(montoN)}</div></div>
              <div style={{background:t.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${t.border}`}}><div style={{fontSize:10,color:t.sub,fontWeight:700,textTransform:"uppercase",marginBottom:3}}>Valor cuota</div><div style={{fontSize:17,fontWeight:900,color:"#10b981"}}>{fmt(tablaFrancesa?cuotaFrancesaFija:valorCuota)}</div></div>
            </div>
            {!tablaFrancesa&&(<div style={{background:t.bg,borderRadius:10,overflow:"hidden",border:`1px solid ${t.border}`}}><div style={{padding:"10px 14px",background:`${t.accent}15`,fontSize:12,fontWeight:700,color:t.accent}}>📅 {cuotasN} cuota{cuotasN!==1?"s":""} {frecuencia.toLowerCase()}{cuotasN!==1?"s":""}</div><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:t.bg}}>{["#","Fecha","Monto"].map(h=><th key={h} style={{padding:"8px 12px",textAlign:"center",fontSize:10,fontWeight:700,color:t.sub,textTransform:"uppercase"}}>{h}</th>)}</tr></thead><tbody>{cuotasDetalle.map(c=>(<tr key={c.num} style={{borderTop:`1px solid ${t.border}`}}><td style={{padding:"9px 12px",textAlign:"center",fontWeight:700,color:t.text}}>{c.num}</td><td style={{padding:"9px 12px",textAlign:"center",color:t.sub}}>{c.fecha}</td><td style={{padding:"9px 12px",textAlign:"center",fontWeight:800,color:"#10b981",fontSize:14}}>{fmt(c.valor)}</td></tr>))}</tbody></table></div>)}
            {tablaFrancesa&&cuotasFrancesas.length>0&&(<div><div style={{background:"#8b5cf610",border:"1px solid #8b5cf630",borderRadius:8,padding:"10px 14px",marginBottom:10,fontSize:11,color:"#8b5cf6",fontWeight:600}}>🏦 Vista interna — El PDF del cliente solo muestra el monto de cada cuota, sin el desglose.</div><div style={{background:t.bg,borderRadius:10,overflow:"hidden",border:`1px solid #8b5cf630`}}><div style={{padding:"10px 14px",background:"#8b5cf615",fontSize:12,fontWeight:700,color:"#8b5cf6"}}>🏦 Tabla francesa — desglose capital + interés</div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr style={{background:t.bg}}>{["#","Fecha","Cuota","Capital","Interés","Saldo"].map(h=>(<th key={h} style={{padding:"7px 10px",textAlign:"center",fontSize:10,fontWeight:700,color:t.sub,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead><tbody>{cuotasFrancesas.map(c=>(<tr key={c.num} style={{borderTop:`1px solid ${t.border}`}}><td style={{padding:"8px 10px",textAlign:"center",fontWeight:700,color:t.text,fontSize:12}}>{c.num}</td><td style={{padding:"8px 10px",textAlign:"center",color:t.sub,fontSize:11}}>{c.fecha}</td><td style={{padding:"8px 10px",textAlign:"center",fontWeight:800,color:"#8b5cf6",fontSize:12}}>{fmt(c.cuota)}</td><td style={{padding:"8px 10px",textAlign:"center",color:"#3b82f6",fontWeight:600,fontSize:12}}>{fmt(c.capital)}</td><td style={{padding:"8px 10px",textAlign:"center",color:"#f59e0b",fontWeight:600,fontSize:12}}>{fmt(c.intereses)}</td><td style={{padding:"8px 10px",textAlign:"center",color:t.sub,fontSize:11}}>{fmt(c.saldoRestante)}</td></tr>))}</tbody><tfoot><tr style={{borderTop:`2px solid ${t.border}`,background:t.bg}}><td colSpan={2} style={{padding:"8px 10px",fontWeight:700,color:t.text,fontSize:11}}>TOTALES</td><td style={{padding:"8px 10px",textAlign:"center",fontWeight:800,color:"#8b5cf6",fontSize:12}}>{fmt(cuotasFrancesas.reduce((s,c)=>s+c.cuota,0))}</td><td style={{padding:"8px 10px",textAlign:"center",fontWeight:800,color:"#3b82f6",fontSize:12}}>{fmt(montoN)}</td><td style={{padding:"8px 10px",textAlign:"center",fontWeight:800,color:"#f59e0b",fontSize:12}}>{fmt(cuotasFrancesas.reduce((s,c)=>s+c.intereses,0))}</td><td></td></tr></tfoot></table></div></div></div>)}
          </>)}
        </div>
      </div>
      {guardados.length>0&&(<div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"22px 24px",marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div><h3 style={{margin:"0 0 3px",fontSize:16,fontWeight:800,color:t.text}}>💾 Presupuestos guardados</h3><p style={{margin:0,fontSize:12,color:t.sub}}>Tocá uno para cargarlo y generar el PDF al toque</p></div><span style={{background:`${t.accent}15`,color:t.accent,padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:700}}>{guardados.length} guardado{guardados.length!==1?"s":""}</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>{guardados.map(g=>{const gMontoN=+g.monto||0;const gTotal=gMontoN+(gMontoN*(+g.porcentaje/100));const gCuota=gTotal/(+g.cuotas||1);return(<div key={g.id} style={{background:t.bg,borderRadius:10,border:`1px solid ${t.border}`,padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div><div style={{fontWeight:700,color:t.text,fontSize:14,marginBottom:3}}>{g.nombre}</div><div style={{fontSize:10,color:t.sub,display:"flex",gap:6,alignItems:"center"}}><span>{g.tipo} · {g.fecha}</span>{g.tablaFrancesa&&<span style={{background:"#8b5cf615",color:"#8b5cf6",padding:"1px 6px",borderRadius:10,fontWeight:700}}>🏦 Francesa</span>}</div></div><button onClick={()=>{if(window.confirm(`¿Eliminar "${g.nombre}"?`)){const nuevos=guardados.filter(x=>x.id!==g.id);setGuardados(nuevos);localStorage.setItem("cc_presupuestos",JSON.stringify(nuevos));}}} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,padding:2}}><Icon name="trash" size={13}/></button></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{[{label:"Monto",value:fmt(gMontoN),color:t.text},{label:"Interés",value:`${g.porcentaje}%`,color:t.accent},{label:"Cuota",value:fmt(gCuota),color:"#10b981"}].map(({label,value,color})=>(<div key={label} style={{background:t.card,borderRadius:6,padding:"6px 8px",textAlign:"center"}}><div style={{color:t.sub,fontSize:9,textTransform:"uppercase",marginBottom:2}}>{label}</div><div style={{fontWeight:800,color,fontSize:12}}>{value}</div></div>))}</div><div style={{fontSize:11,color:t.sub,textAlign:"center"}}>{g.cuotas} cuota{+g.cuotas!==1?"s":""} {g.frecuencia.toLowerCase()}{+g.cuotas!==1?"s":""} · Total: {fmt(gTotal)}</div><div style={{display:"flex",gap:8}}><button onClick={()=>{setMonto(g.monto);setPorcentaje(g.porcentaje);setCuotas(g.cuotas);setFrecuencia(g.frecuencia);setTipo(g.tipo);setTablaFrancesa(g.tablaFrancesa||false);}} style={{flex:1,background:`${t.accent}15`,color:t.accent,border:`1px solid ${t.accent}30`,borderRadius:8,padding:"8px",fontWeight:700,fontSize:12,cursor:"pointer"}}>📥 Cargar</button><button onClick={()=>{setMonto(g.monto);setPorcentaje(g.porcentaje);setCuotas(g.cuotas);setFrecuencia(g.frecuencia);setTipo(g.tipo);setTablaFrancesa(g.tablaFrancesa||false);setTimeout(()=>generarPDF(),150);}} style={{flex:1,background:"#ef4444",color:"#fff",border:"none",borderRadius:8,padding:"8px",fontWeight:700,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}><Icon name="pdf" size={12}/>PDF directo</button></div></div>);})}</div></div>)}
    </div>
  );
};
const Papelera=({setCreditos,setProductos,t})=>{
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);

  const cargarPapelera=async()=>{
    setLoading(true);
    const {data}=await sb.from("papelera").select("*").order("created_at",{ascending:false});
    if(data){
      const hace24hs=new Date(Date.now()-24*60*60*1000);
      setItems(data.filter(i=>new Date(i.created_at)>hace24hs));
    }
    setLoading(false);
  };

  useEffect(()=>{cargarPapelera();},[]);

  const restaurar=async(item)=>{
    const d=item.datos;
    if(item.tipo==="credito"){
      const data={cliente_id:d.clienteId,cliente_nombre:d.clienteNombre,monto:d.monto,total_cobrar:d.totalCobrar,ganancia:d.ganancia,cuotas:d.cuotas,cuotas_pagadas:d.cuotasPagadas,valor_cuota:d.valorCuota,saldo_cobrado:d.saldoCobrado,saldo_pendiente:d.saldoPendiente,frecuencia:d.frecuencia,fecha_otorg:d.fechaOtorg,proximo_pago:d.proximoPago,estado:d.estado,comentarios:d.comentarios||"",historial:d.historial||[],detalle_cuotas:d.detalleCuotas||[],usuario_id:d.usuarioId||0};
      const {data:cr}=await sb.from("creditos").insert(data).select().single();
      if(cr)setCreditos(cs=>[...cs,creditoFromDB(cr)]);
    } else if(item.tipo==="producto"){
      const data={cliente_id:d.clienteId,cliente_nombre:d.clienteNombre,producto:d.producto,inversion:d.inversion,precio_financiado:d.precioFinanciado,ganancia:d.ganancia,cuotas:d.cuotas,cuotas_pagadas:d.cuotasPagadas,saldo_cobrado:d.saldoCobrado,valor_cuota:d.valorCuota,estado:d.estado,frecuencia:d.frecuencia,usuario_id:d.usuarioId||0};
      const {data:pr}=await sb.from("productos").insert(data).select().single();
      if(pr)setProductos(ps=>[...ps,productoFromDB(pr)]);
    }
    await sb.from("papelera").delete().eq("id",item.id);
    setItems(is=>is.filter(i=>i.id!==item.id));
    alert("Restaurado correctamente");
  };

  const eliminarDef=async(id)=>{
    if(window.confirm("Eliminar definitivamente?")){ await sb.from("papelera").delete().eq("id",id); setItems(is=>is.filter(i=>i.id!==id)); }
  };

  const tiempoRestante=(createdAt)=>{
    const diff=new Date(new Date(createdAt).getTime()+24*60*60*1000)-new Date();
    if(diff<=0)return"Expirado";
    const hs=Math.floor(diff/3600000);const min=Math.floor((diff%3600000)/60000);
    return`${hs}h ${min}m`;
  };

  return(
    <div>
      <div style={{marginBottom:22}}><h1 style={{fontSize:22,fontWeight:800,color:t.text,margin:"0 0 4px"}}>🗑 Papelera</h1><p style={{color:t.sub,margin:0,fontSize:13}}>Los elementos eliminados se guardan 24 horas.</p></div>
      {loading?<div style={{textAlign:"center",padding:"40px",color:t.sub}}>Cargando...</div>:items.length===0?(
        <div style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"60px",textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>🗑</div><div style={{fontSize:15,fontWeight:700,color:t.text,marginBottom:6}}>La papelera está vacía</div><div style={{fontSize:13,color:t.sub}}>Los créditos y ventas que elimines aparecerán acá por 24 horas</div></div>
      ):(
        <div style={{display:"grid",gap:12}}>
          {items.map(item=>{
            const d=item.datos;const esC=item.tipo==="credito";
            return(
              <div key={item.id} style={{background:t.card,borderRadius:14,border:`1px solid ${t.border}`,padding:"18px 22px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:15,fontWeight:700,color:t.text}}>{esC?d.clienteNombre:d.producto}</span>
                      <span style={{background:esC?"#dbeafe":"#d1fae5",color:esC?"#1e40af":"#065f46",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:700}}>{esC?"Crédito":"Producto"}</span>
                    </div>
                    <div style={{fontSize:12,color:t.sub,display:"flex",gap:14,flexWrap:"wrap"}}>
                      {esC&&<><span>Capital: <strong>{fmt(d.monto)}</strong></span><span>Saldo: <strong style={{color:"#ef4444"}}>{fmt(d.saldoPendiente)}</strong></span></>}
                      {!esC&&<><span>Inversión: <strong>{fmt(d.inversion)}</strong></span></>}
                      <span>Eliminado por: <strong>{item.eliminado_por}</strong></span>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:11,color:"#f59e0b",fontWeight:600,background:"#fef3c7",padding:"3px 8px",borderRadius:8}}>⏱ {tiempoRestante(item.created_at)}</span>
                    <button onClick={()=>restaurar(item)} style={{background:"#10b981",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer"}}>↩ Restaurar</button>
                    <button onClick={()=>eliminarDef(item.id)} style={{background:"none",border:"1px solid #fca5a5",borderRadius:8,padding:"7px 10px",fontSize:12,cursor:"pointer",color:"#ef4444",display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── APP ROOT ──────────────────────────────────────────────────────────────────
// ── APP ROOT ──────────────────────────────────────────────────────────────────
// ── TARJETA COBRO MÓVIL ───────────────────────────────────────────────────────
const TarjetaCobro=({c,colorBorde,clients,t,onCobrar})=>{
  const clienteInfo=clients.find(cl=>cl.id===c.clienteId);
  const diffLabel=c.diff===0?"HOY":c.diff===-1?"Ayer":c.diff>0?`En ${c.diff}d`:`Hace ${Math.abs(c.diff)}d`;
  const colDiff=c.diff===0?"#10b981":c.diff>0?"#3b82f6":"#ef4444";
  return(
    <div style={{background:t.card,borderRadius:14,border:`2px solid ${colorBorde}`,padding:"14px 16px",marginBottom:10}}>
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{fontWeight:800,color:t.text,fontSize:15}}>{c.clienteNombre}</span>
          {c._tipo==="producto"
            ?<span style={{fontSize:10,background:"#8b5cf6",color:"#fff",borderRadius:20,padding:"2px 8px",fontWeight:700}}>🛒 {c._etiqueta}</span>
            :<span style={{fontSize:10,background:"#3b82f6",color:"#fff",borderRadius:20,padding:"2px 8px",fontWeight:700}}>💳 Crédito</span>}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:900,color:t.text}}>{fmt(c.proxCuota?.valorCuotaEditado||c.valorCuota)}</span>
          <span style={{fontSize:12,fontWeight:700,color:colDiff,background:`${colDiff}15`,padding:"2px 8px",borderRadius:20}}>{diffLabel}</span>
          <span style={{fontSize:11,color:t.sub}}>{c.cuotasPagadas}/{c.cuotas} cuotas</span>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>onCobrar(c)}
          style={{flex:1,background:"#10b981",color:"#fff",border:"none",borderRadius:10,padding:"12px",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          ✓ Cobrado
        </button>
        {clienteInfo?.tel&&(
          <a href={`https://wa.me/54${clienteInfo.tel.replace(/\D/g,"")}?text=${encodeURIComponent(`Hola ${clienteInfo.nombre}, te escribo por el pago de hoy.`)}`}
            target="_blank" rel="noopener noreferrer"
            style={{background:"#25D366",color:"#fff",borderRadius:10,padding:"12px 16px",fontWeight:700,fontSize:14,textDecoration:"none",display:"flex",alignItems:"center",gap:5}}>
            <Icon name="whatsapp" size={18}/>
          </a>
        )}
      </div>
    </div>
  );
};

export default function App(){
  const [dark,setDark]=useState(true);
  const [screen,setScreen]=useState("dashboard");
  const [fabOpen,setFabOpen]=useState(false);
  const [fabModal,setFabModal]=useState(null);
  const [allClients,setAllClients]=useState([]);
  const [allCreditos,setAllCreditos]=useState([]);
  const [allProductos,setAllProductos]=useState([]);
  const [allVentasContado,setAllVentasContado]=useState([]);
  const [sideOpen,setSideOpen]=useState(true);
  const [loggedIn,setLoggedIn]=useState(false);
  const [usuarioActual,setUsuarioActual]=useState(null);
  const [loginForm,setLoginForm]=useState({user:"",pass:""});
  const [loginErr,setLoginErr]=useState("");
  const [loadingData,setLoadingData]=useState(false);
  const [offline,setOffline]=useState(!navigator.onLine);
  const [colaPendiente,setColaPendiente]=useState(0);
  const [sincronizando,setSincronizando]=useState(false);
  const [mostrarBannerSync,setMostrarBannerSync]=useState(false);
  // Detección automática de celular + toggle manual
  const [mobile,setMobile]=useState(()=>window.innerWidth<768);
  const t=dark?DARK:LIGHT;

  // Registrar Service Worker
  useEffect(()=>{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }
  },[]);

  // Detectar online/offline
  useEffect(()=>{
    const goOffline=()=>{setOffline(true);};
    const goOnline=async()=>{
      setOffline(false);
      // Al volver online, sincronizar cola automáticamente
      if(loggedIn){
        setSincronizando(true);
        setMostrarBannerSync(true);
        try{
          const {sincronizados,errores}=await sincronizarCola(sb);
          if(sincronizados>0){
            // Recargar datos frescos de Supabase
            await cargarDatos(usuarioActual);
          }
          setColaPendiente(0);
        }catch(e){}
        setSincronizando(false);
        setTimeout(()=>setMostrarBannerSync(false),3000);
      }
    };
    window.addEventListener("offline",goOffline);
    window.addEventListener("online",goOnline);
    return()=>{window.removeEventListener("offline",goOffline);window.removeEventListener("online",goOnline);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loggedIn,usuarioActual]);

  const esAdmin=usuarioActual?.rol==="admin"||usuarioActual?.user==="andres";
  const soloVer=usuarioActual?.rol==="administrador"; // Solo puede ver, no editar
  // Todos ven solo sus propios datos — admin NO ve todo automáticamente
  const uid=usuarioActual?.id||0;
  const clients=allClients.filter(c=>c.usuarioId===uid);
  const creditos=allCreditos.filter(c=>c.usuarioId===uid);
  const productos=allProductos.filter(p=>p.usuarioId===uid);
  const ventasContado=allVentasContado.filter(v=>v.usuario_id===uid);
  const setClients=(fn)=>setAllClients(fn);
  const setCreditos=async(fn)=>{
    setAllCreditos(prev=>{
      const nuevo=typeof fn==="function"?fn(prev):fn;
      // Guardar en local siempre
      const uid2=usuarioActual?.id||0;
      const soloMios=nuevo.filter(c=>c.usuarioId===uid2);
      saveToLocal("creditos",soloMios.map(c=>({id:c.id,cliente_id:c.clienteId,cliente_nombre:c.clienteNombre,monto:c.monto,total_cobrar:c.totalCobrar,ganancia:c.ganancia,cuotas:c.cuotas,cuotas_pagadas:c.cuotasPagadas,valor_cuota:c.valorCuota,saldo_cobrado:c.saldoCobrado,saldo_pendiente:c.saldoPendiente,frecuencia:c.frecuencia,fecha_otorg:c.fechaOtorg,proximo_pago:c.proximoPago,estado:c.estado,comentarios:c.comentarios,historial:c.historial,detalle_cuotas:c.detalleCuotas,usuario_id:c.usuarioId}))).catch(()=>{});
      return nuevo;
    });
  };
  const setProductos=async(fn)=>{
    setAllProductos(prev=>{
      const nuevo=typeof fn==="function"?fn(prev):fn;
      const uid2=usuarioActual?.id||0;
      const soloMios=nuevo.filter(p=>p.usuarioId===uid2);
      saveToLocal("productos",soloMios.map(p=>({id:p.id,cliente_id:p.clienteId,cliente_nombre:p.clienteNombre,producto:p.producto,inversion:p.inversion,precio_financiado:p.precioFinanciado,ganancia:p.ganancia,cuotas:p.cuotas,cuotas_pagadas:p.cuotasPagadas,saldo_cobrado:p.saldoCobrado,saldo_pendiente:p.saldoPendiente,valor_cuota:p.valorCuota,estado:p.estado,frecuencia:p.frecuencia,usuario_id:p.usuarioId,detalle_cuotas:p.detalleCuotas,fecha_otorg:p.fechaOtorg,proximo_pago:p.proximoPago}))).catch(()=>{});
      return nuevo;
    });
  };
  const setVentasContado=(fn)=>setAllVentasContado(fn);

  const cargarDatos=async(usuario)=>{
    setLoadingData(true);
    if(navigator.onLine){
      // Online: cargar de Supabase y guardar en local
      try{
        const [{data:cls},{data:crs},{data:prds},{data:vcs}]=await Promise.all([
          sb.from("clientes").select("*").order("id"),
          sb.from("creditos").select("*").order("id"),
          sb.from("productos").select("*").order("id"),
          sb.from("ventas_contado").select("*").order("id"),
        ]);
        if(cls){setAllClients(cls.map(clientFromDB));await saveToLocal("clientes",cls);}
        if(crs){setAllCreditos(crs.map(creditoFromDB));await saveToLocal("creditos",crs);}
        if(prds){setAllProductos(prds.map(productoFromDB));await saveToLocal("productos",prds);}
        if(vcs){setAllVentasContado(vcs);await saveToLocal("ventas_contado",vcs);}
      }catch(e){
        // Si falla, cargar de local
        await cargarDatosLocal();
      }
    } else {
      // Offline: cargar de IndexedDB
      await cargarDatosLocal();
    }
    setLoadingData(false);
  };

  const cargarDatosLocal=async()=>{
    try{
      await initDB();
      const [cls,crs,prds,vcs]=await Promise.all([
        getFromLocal("clientes"),
        getFromLocal("creditos"),
        getFromLocal("productos"),
        getFromLocal("ventas_contado"),
      ]);
      if(cls.length)setAllClients(cls.map(clientFromDB));
      if(crs.length)setAllCreditos(crs.map(creditoFromDB));
      if(prds.length)setAllProductos(prds.map(productoFromDB));
      if(vcs.length)setAllVentasContado(vcs);
    }catch(e){console.error("Error cargando datos locales",e);}
  };

  const doLogin=async()=>{
    if(!loginForm.user||!loginForm.pass){setLoginErr("Completá usuario y contraseña");return;}
    if(loginForm.user==="andres"&&loginForm.pass==="Laliga2215"){
      const u={id:0,nombre:"Andres",user:"andres",rol:"admin"};
      setUsuarioActual(u);setLoggedIn(true);setLoginErr("");cargarDatos(u);return;
    }
    const {data}=await sb.from("usuarios").select("*").eq("user_name",loginForm.user).eq("password",loginForm.pass).eq("activo",true).single();
    if(data){
      const u=usuarioFromDB(data);
      setUsuarioActual(u);setLoggedIn(true);setLoginErr("");cargarDatos(u);
    } else setLoginErr("Usuario o contraseña incorrectos");
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
    {id:"presupuesto",label:"Presupuesto",icon:"coin"},
    ...(esAdmin?[{id:"usuarios",label:"Usuarios",icon:"users"}]:[]),
    {id:"papelera",label:"Papelera",icon:"trash"},
  ];
  const alertCount=creditos.filter(c=>c.estado==="Moroso"||c.estado==="Atrasado").length;

  // ── MODO MÓVIL ────────────────────────────────────────────────────────────────
  if(mobile){

    // ── PANTALLA COBROS DEL DÍA ──
    const hoyMob=new Date();hoyMob.setHours(0,0,0,0);
    const fuentePagosMob=[
      ...creditos.filter(c=>c.estado!=="Finalizado").map(c=>({...c,_tipo:"credito"})),
      ...productos.filter(p=>p.estado!=="Finalizado").map(p=>({...p,monto:p.inversion,totalCobrar:p.precioFinanciado,historial:[],_tipo:"producto",_etiqueta:p.producto})),
    ];
    const cobrosDia=fuentePagosMob.map(c=>{
      const det=c.detalleCuotas||[];
      const pendientes=det.filter(d=>d.estado==="Pendiente"||d.estado==="Parcial").sort((a,b)=>new Date(a.fechaVenc)-new Date(b.fechaVenc));
      if(!pendientes.length)return null;
      const prox=pendientes[0];
      const proxFecha=prox.fechaVenc?new Date(prox.fechaVenc):null;
      if(proxFecha)proxFecha.setHours(0,0,0,0);
      const diff=proxFecha?Math.round((proxFecha-hoyMob)/(1000*60*60*24)):null;
      if(diff===null||diff>3)return null;
      const cat=diff<-15?"moroso":diff<0?"vencido":"aldia";
      return{...c,proxCuota:prox,diff,cat,pendientesCount:pendientes.length};
    }).filter(Boolean).sort((a,b)=>a.diff-b.diff);

    const cobrosHoy=cobrosDia.filter(c=>c.diff===0);
    const cobrosVencidos=cobrosDia.filter(c=>c.diff<0);
    const cobrosMañana=cobrosDia.filter(c=>c.diff>0&&c.diff<=3);
    const totalHoy=cobrosHoy.reduce((s,c)=>s+(c.proxCuota?.valorCuotaEditado||c.valorCuota||0),0);

    const marcarCobradoMob=async(c)=>{
      if(!window.confirm(`¿Marcar cuota de ${fmt(c.proxCuota?.valorCuotaEditado||c.valorCuota)} como pagada?`))return;
      const det=[...(c.detalleCuotas||[])];
      const idx=det.findIndex(d=>d.estado==="Pendiente"||d.estado==="Parcial");
      if(idx===-1)return;
      const vc=det[idx].valorCuotaEditado||c.valorCuota;
      det[idx]={...det[idx],montoPagado:vc,estado:"Pagada",fechaPago:new Date().toLocaleDateString("es-AR")};
      const totalCobrado=det.reduce((s,d)=>s+d.montoPagado,0);
      const nuevoTotal=det.reduce((s,d)=>s+(d.valorCuotaEditado||c.valorCuota),0);
      const pendiente=Math.max(0,nuevoTotal-totalCobrado);
      const pagadas=det.filter(d=>d.estado==="Pagada").length;
      const proxPend=det.find(d=>d.estado!=="Pagada");
      const nuevoEstado=pendiente<=0?"Finalizado":"Al día";
      const tabla=c._tipo==="producto"?"productos":"creditos";
      const updateData={cuotas_pagadas:pagadas,saldo_cobrado:totalCobrado,saldo_pendiente:pendiente,proximo_pago:proxPend?.fechaVenc||"",estado:nuevoEstado,detalle_cuotas:det};
      if(c._tipo!=="producto")updateData.historial=[...(c.historial||[]),{tipo:"pago_completo",cuota:idx+1,monto:vc,fecha:new Date().toLocaleDateString("es-AR")}];

      if(navigator.onLine){
        await sb.from(tabla).update(updateData).eq("id",c.id);
      } else {
        // Offline: guardar en cola para sincronizar después
        await agregarACola({tipo:`update_${tabla.slice(0,-1)}`,id_registro:c.id,datos:updateData});
        setColaPendiente(p=>p+1);
      }

      if(c._tipo==="producto")setProductos(ps=>ps.map(x=>x.id===c.id?{...x,cuotasPagadas:pagadas,saldoCobrado:totalCobrado,saldoPendiente:pendiente,proximoPago:proxPend?.fechaVenc||"",estado:nuevoEstado,detalleCuotas:det}:x));
      else setCreditos(cs=>cs.map(x=>x.id===c.id?{...x,cuotasPagadas:pagadas,saldoCobrado:totalCobrado,saldoPendiente:pendiente,proximoPago:proxPend?.fechaVenc||"",estado:nuevoEstado,detalleCuotas:det}:x));
    };

    return(
      <div style={{display:"flex",flexDirection:"column",minHeight:"100vh",fontFamily:"'Segoe UI',system-ui,sans-serif",background:t.bg,color:t.text}}>

        {/* Header móvil */}
        <header style={{background:t.sidebar,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:28,height:28,borderRadius:8,background:t.accent,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="coin" size={14}/></div>
            <span style={{fontSize:14,fontWeight:900,color:"#fff"}}>Control<span style={{color:t.accent}}>Credit</span></span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {alertCount>0&&<div style={{background:"#ef4444",color:"#fff",borderRadius:20,padding:"2px 8px",fontSize:11,fontWeight:700}}>{alertCount}</div>}
            <button onClick={()=>setMobile(false)} style={{background:"none",border:"1px solid #ffffff20",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"#94a3b8",fontSize:10,fontWeight:600}}>🖥 PC</button>
            <button onClick={()=>setDark(d=>!d)} style={{background:"none",border:"none",cursor:"pointer",color:"#94a3b8",padding:4}}><Icon name={dark?"sun":"moon"} size={16}/></button>
            <div style={{width:28,height:28,borderRadius:"50%",background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12}}>{(usuarioActual?.nombre||"A")[0].toUpperCase()}</div>
          </div>
        </header>

        {/* Banner offline / sincronizando */}
        {(offline||mostrarBannerSync)&&(
          <div style={{background:offline?"#ef4444":sincronizando?"#f59e0b":"#10b981",color:"#fff",padding:"8px 16px",fontSize:12,fontWeight:700,textAlign:"center",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {offline&&<>📵 Sin internet — los cambios se guardan y sincronizan al volver</>}
            {!offline&&sincronizando&&<>⏳ Sincronizando cambios offline...</>}
            {!offline&&!sincronizando&&mostrarBannerSync&&<>✅ Todo sincronizado con la nube</>}
          </div>
        )}
        {colaPendiente>0&&!offline&&(
          <div style={{background:"#f59e0b",color:"#fff",padding:"6px 16px",fontSize:11,fontWeight:600,textAlign:"center"}}>
            {colaPendiente} cambio{colaPendiente!==1?"s":""} pendiente{colaPendiente!==1?"s":""} de sincronizar
          </div>
        )}

        {/* Contenido móvil */}
        <main style={{flex:1,padding:"14px 14px 90px",overflowY:"auto"}}>

          {/* ── PANTALLA COBROS DEL DÍA ── */}
          {screen==="cobros"&&(
            <div>
              <div style={{marginBottom:16}}>
                <h1 style={{fontSize:20,fontWeight:900,color:t.text,margin:"0 0 2px"}}>☀️ Cobros del día</h1>
                <p style={{color:t.sub,margin:0,fontSize:12}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}</p>
              </div>

              {/* Resumen rápido */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
                <div style={{background:"#10b98115",border:"1px solid #10b98130",borderRadius:12,padding:"14px"}}>
                  <div style={{fontSize:10,color:"#10b981",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Cobrar HOY</div>
                  <div style={{fontSize:22,fontWeight:900,color:"#10b981"}}>{fmt(totalHoy)}</div>
                  <div style={{fontSize:11,color:t.sub,marginTop:2}}>{cobrosHoy.length} cliente{cobrosHoy.length!==1?"s":""}</div>
                </div>
                <div style={{background:"#ef444415",border:"1px solid #ef444430",borderRadius:12,padding:"14px"}}>
                  <div style={{fontSize:10,color:"#ef4444",fontWeight:700,textTransform:"uppercase",marginBottom:4}}>Vencidos</div>
                  <div style={{fontSize:22,fontWeight:900,color:"#ef4444"}}>{cobrosVencidos.length}</div>
                  <div style={{fontSize:11,color:t.sub,marginTop:2}}>sin cobrar</div>
                </div>
              </div>

              {cobrosDia.length===0&&(
                <div style={{textAlign:"center",padding:"50px 0",color:t.sub}}>
                  <div style={{fontSize:48,marginBottom:12}}>🎉</div>
                  <div style={{fontSize:16,fontWeight:700,color:t.text}}>Sin cobros pendientes hoy</div>
                  <div style={{fontSize:13,marginTop:6}}>Todos al día por los próximos 3 días</div>
                </div>
              )}

              {cobrosVencidos.length>0&&(
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#ef4444",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#ef4444",display:"inline-block"}}/>
                    VENCIDOS — {cobrosVencidos.length}
                  </div>
                  {cobrosVencidos.map(c=><TarjetaCobro key={`${c._tipo}-${c.id}`} c={c} clients={clients} t={t} onCobrar={marcarCobradoMob} colorBorde="#ef4444"/>)}
                </div>
              )}

              {cobrosHoy.length>0&&(
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#10b981",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#10b981",display:"inline-block"}}/>
                    VENCEN HOY — {cobrosHoy.length}
                  </div>
                  {cobrosHoy.map(c=><TarjetaCobro key={`${c._tipo}-${c.id}`} c={c} clients={clients} t={t} onCobrar={marcarCobradoMob} colorBorde="#10b981"/>)}
                </div>
              )}

              {cobrosMañana.length>0&&(
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#3b82f6",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:"#3b82f6",display:"inline-block"}}/>
                    PRÓXIMOS (1-3 DÍAS) — {cobrosMañana.length}
                  </div>
                  {cobrosMañana.map(c=><TarjetaCobro key={`${c._tipo}-${c.id}`} c={c} clients={clients} t={t} onCobrar={marcarCobradoMob} colorBorde="#3b82f6"/>)}
                </div>
              )}
            </div>
          )}

          {screen==="dashboard"&&<Dashboard clients={clients} creditos={creditos} setCreditos={setCreditos} productos={productos} setProductos={setProductos} ventasContado={ventasContado} t={t}/>}
          {screen==="clientes"&&<Clientes clients={clients} setClients={setClients} creditos={creditos} setCreditos={setCreditos} productos={productos} usuarioActual={usuarioActual} soloVer={soloVer} t={t}/>}
          {screen==="creditos"&&<Creditos creditos={creditos} setCreditos={setCreditos} clients={clients} usuarioActual={usuarioActual} soloVer={soloVer} t={t}/>}
          {screen==="productos"&&<Productos productos={productos} setProductos={setProductos} ventasContado={ventasContado} setVentasContado={setVentasContado} clients={clients} usuarioActual={usuarioActual} soloVer={soloVer} t={t}/>}
          {screen==="cartera"&&<Cartera creditos={creditos} productos={productos} clients={clients} t={t}/>}
          {screen==="alertas"&&<Alertas creditos={creditos} clients={clients} t={t}/>}
          {screen==="usuarios"&&esAdmin&&<AdminUsuarios t={t} allClients={allClients} allCreditos={allCreditos} allProductos={allProductos} allVentasContado={allVentasContado}/>}
          {screen==="presupuesto"&&<Presupuesto t={t}/>}
          {screen==="papelera"&&<Papelera setCreditos={setCreditos} setProductos={setProductos} t={t}/>}
        </main>

        {/* ── BARRA NAV INFERIOR ── */}
        <nav style={{position:"fixed",bottom:0,left:0,right:0,background:t.sidebar,borderTop:"1px solid #ffffff15",display:"flex",justifyContent:"space-around",padding:"6px 0 8px",zIndex:200,boxShadow:"0 -4px 20px rgba(0,0,0,0.3)"}}>
          {[
            {id:"cobros",label:"Cobros",icon:"coin"},
            {id:"clientes",label:"Clientes",icon:"users"},
            {id:"dashboard",label:"Dashboard",icon:"dashboard"},
            {id:"creditos",label:"Créditos",icon:"creditos"},
            {id:"alertas",label:"Alertas",icon:"alert"},
          ].map(n=>(
            <button key={n.id} onClick={()=>{setScreen(n.id);setFabOpen(false);}}
              style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 8px",background:"none",border:"none",cursor:"pointer",color:screen===n.id?t.accent:t.sidebarText,flex:1,position:"relative"}}>
              {n.id==="cobros"&&cobrosHoy.length>0&&screen!=="cobros"
                ?<div style={{position:"relative"}}><Icon name={n.icon} size={20}/><span style={{position:"absolute",top:-4,right:-6,background:"#10b981",color:"#fff",borderRadius:10,padding:"0 4px",fontSize:9,fontWeight:700}}>{cobrosHoy.length}</span></div>
                :<Icon name={n.icon} size={20}/>}
              <span style={{fontSize:9,fontWeight:screen===n.id?700:400,whiteSpace:"nowrap"}}>{n.label}</span>
              {n.id==="alertas"&&alertCount>0&&<span style={{position:"absolute",top:0,right:"20%",background:"#ef4444",color:"#fff",borderRadius:10,padding:"0 4px",fontSize:9,fontWeight:700}}>{alertCount}</span>}
            </button>
          ))}
          <button onClick={()=>setFabOpen(o=>!o)}
            style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 8px",background:"none",border:"none",cursor:"pointer",color:fabOpen?t.accent:t.sidebarText,flex:1}}>
            <Icon name="menu" size={20}/>
            <span style={{fontSize:9,fontWeight:400}}>Más</span>
          </button>
        </nav>

        {/* ── FAB — Botón flotante agregar ── */}
        {!fabOpen&&(
          <button
            onClick={()=>setFabOpen(true)}
            style={{position:"fixed",bottom:72,right:16,zIndex:300,width:52,height:52,borderRadius:"50%",background:t.accent,color:"#fff",border:"none",cursor:"pointer",boxShadow:"0 4px 20px rgba(59,130,246,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:300,transition:"transform 0.2s"}}
            onTouchStart={e=>e.currentTarget.style.transform="scale(0.92)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
            +
          </button>
        )}

        {/* ── FAB ABIERTO — opciones ── */}
        {fabOpen&&(
          <>
            {/* Overlay para cerrar */}
            <div onClick={()=>setFabOpen(false)} style={{position:"fixed",inset:0,zIndex:290,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(2px)"}}/>

            {/* Acciones rápidas agregar */}
            <div style={{position:"fixed",bottom:72,right:16,zIndex:300,display:"flex",flexDirection:"column",gap:10,alignItems:"flex-end"}}>
              {[
                {label:"Nuevo cliente",icon:"👤",color:"#10b981",action:()=>{setScreen("clientes");setFabOpen(false);}},
                {label:"Nuevo crédito",icon:"💳",color:"#3b82f6",action:()=>{setScreen("creditos");setFabOpen(false);}},
                {label:"Nueva venta financiada",icon:"🛒",color:"#8b5cf6",action:()=>{setScreen("productos");setFabOpen(false);}},
                {label:"Venta de contado",icon:"💵",color:"#f59e0b",action:()=>{setScreen("productos");setFabOpen(false);}},
              ].map((op,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10,animation:`fadeSlideUp 0.15s ease ${i*0.04}s both`}}>
                  <span style={{background:t.card,color:t.text,borderRadius:10,padding:"8px 14px",fontWeight:700,fontSize:13,boxShadow:"0 2px 12px rgba(0,0,0,0.2)",border:`1px solid ${t.border}`,whiteSpace:"nowrap"}}>{op.label}</span>
                  <button onClick={op.action}
                    style={{width:46,height:46,borderRadius:"50%",background:op.color,color:"#fff",border:"none",cursor:"pointer",boxShadow:`0 4px 14px ${op.color}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                    {op.icon}
                  </button>
                </div>
              ))}
              {/* Opciones de navegación */}
              <div style={{width:"100%",height:1,background:"#ffffff20",margin:"4px 0"}}/>
              {[
                {label:"Presupuesto",icon:"🧮",action:()=>{setScreen("presupuesto");setFabOpen(false);}},
                {label:"Cartera",icon:"💼",action:()=>{setScreen("cartera");setFabOpen(false);}},
                {label:"Papelera",icon:"🗑",action:()=>{setScreen("papelera");setFabOpen(false);}},
                ...(esAdmin?[{label:"Usuarios",icon:"👥",action:()=>{setScreen("usuarios");setFabOpen(false);}}]:[]),
                {label:"Cerrar sesión",icon:"🚪",color:"#ef4444",action:()=>{setLoggedIn(false);setUsuarioActual(null);setAllClients([]);setAllCreditos([]);setAllProductos([]);}},
              ].map((op,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{background:t.card,color:op.color||t.text,borderRadius:10,padding:"8px 14px",fontWeight:600,fontSize:13,boxShadow:"0 2px 12px rgba(0,0,0,0.15)",border:`1px solid ${t.border}`,whiteSpace:"nowrap"}}>{op.label}</span>
                  <button onClick={op.action}
                    style={{width:46,height:46,borderRadius:"50%",background:op.color||t.card,color:op.color?"#fff":t.text,border:`1px solid ${op.color||t.border}`,cursor:"pointer",boxShadow:"0 2px 10px rgba(0,0,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
                    {op.icon}
                  </button>
                </div>
              ))}
              {/* X para cerrar */}
              <button onClick={()=>setFabOpen(false)}
                style={{width:52,height:52,borderRadius:"50%",background:"#ef4444",color:"#fff",border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:300,alignSelf:"flex-end"}}>
                ✕
              </button>
            </div>
          </>
        )}

        <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }

  // ── MODO ESCRITORIO ───────────────────────────────────────────────────────────
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
          <button onClick={()=>setMobile(true)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:t.sidebarText,fontSize:13,marginBottom:4}}><span style={{fontSize:16}}>📱</span>{sideOpen&&<span>Modo celular</span>}</button>
          <button onClick={()=>setDark(d=>!d)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:t.sidebarText,fontSize:13,marginBottom:4}}><Icon name={dark?"sun":"moon"} size={18}/>{sideOpen&&<span>{dark?"Modo claro":"Modo oscuro"}</span>}</button>
          <button onClick={()=>{setLoggedIn(false);setUsuarioActual(null);setAllClients([]);setAllCreditos([]);setAllProductos([]);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:"none",cursor:"pointer",background:"transparent",color:"#ef4444",fontSize:13}}><Icon name="logout" size={18}/>{sideOpen&&<span>Cerrar sesión</span>}</button>
        </div>
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        <header style={{background:t.card,padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${t.border}`,position:"sticky",top:0,zIndex:100}}>
          <button onClick={()=>setSideOpen(o=>!o)} style={{background:"none",border:"none",cursor:"pointer",color:t.sub,padding:4,borderRadius:6}}><Icon name="menu" size={20}/></button>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {offline&&<div style={{background:"#ef4444",color:"#fff",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:5}}>📵 Sin internet</div>}
            {sincronizando&&<div style={{background:"#f59e0b",color:"#fff",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:700}}>⏳ Sincronizando...</div>}
            {mostrarBannerSync&&!sincronizando&&<div style={{background:"#10b981",color:"#fff",borderRadius:8,padding:"4px 12px",fontSize:12,fontWeight:700}}>✅ Sincronizado</div>}
            {alertCount>0&&<div style={{display:"flex",alignItems:"center",gap:6,background:"#fef3c7",color:"#92400e",borderRadius:8,padding:"4px 10px",fontSize:12,fontWeight:600}}><Icon name="alert" size={14}/>{alertCount} alertas</div>}
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:t.accent,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13}}>{(usuarioActual?.nombre||"A")[0].toUpperCase()}</div>
              {sideOpen&&<span style={{fontSize:12,color:t.sub}}>{usuarioActual?.nombre}</span>}
            </div>
          </div>
        </header>
        <main style={{flex:1,padding:"26px",overflowY:"auto"}}>
          {screen==="dashboard"&&<Dashboard clients={clients} creditos={creditos} setCreditos={setCreditos} productos={productos} setProductos={setProductos} ventasContado={ventasContado} t={t}/>}
          {screen==="clientes"&&<Clientes clients={clients} setClients={setClients} creditos={creditos} setCreditos={setCreditos} productos={productos} usuarioActual={usuarioActual} soloVer={soloVer} t={t}/>}
          {screen==="creditos"&&<Creditos creditos={creditos} setCreditos={setCreditos} clients={clients} usuarioActual={usuarioActual} soloVer={soloVer} t={t}/>}
          {screen==="productos"&&<Productos productos={productos} setProductos={setProductos} ventasContado={ventasContado} setVentasContado={setVentasContado} clients={clients} usuarioActual={usuarioActual} soloVer={soloVer} t={t}/>}
          {screen==="cartera"&&<Cartera creditos={creditos} productos={productos} clients={clients} t={t}/>}
          {screen==="alertas"&&<Alertas creditos={creditos} clients={clients} t={t}/>}
          {screen==="usuarios"&&esAdmin&&<AdminUsuarios t={t} allClients={allClients} allCreditos={allCreditos} allProductos={allProductos} allVentasContado={allVentasContado}/>}
          {screen==="presupuesto"&&<Presupuesto t={t}/>}
          {screen==="papelera"&&<Papelera setCreditos={setCreditos} setProductos={setProductos} t={t}/>}
        </main>
      </div>
    </div>
  );
}
