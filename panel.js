<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel — Micaela Jairedin</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Montserrat',sans-serif;background:#f5f5f3;color:#1a1a1a;min-height:100vh;}
.layout{display:grid;grid-template-columns:290px 1fr;min-height:100vh;}
.sidebar{background:#fff;border-right:1px solid #eee;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;overflow:hidden;}
.sb-top{padding:14px 16px;border-bottom:1px solid #eee;}
.sb-top h1{font-size:14px;font-weight:700;}
.sb-top p{font-size:10px;color:#999;margin-top:1px;}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:8px;}
.stat{background:#f9f8f8;border-radius:7px;padding:8px 10px;}
.stat-l{font-size:9px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
.stat-v{font-size:18px;font-weight:700;color:#8C7B80;}
.refresh-btn{margin:0 8px 6px;padding:7px;font-size:11px;font-weight:600;font-family:'Montserrat',sans-serif;background:transparent;border:1px solid #eee;border-radius:7px;cursor:pointer;color:#666;width:calc(100% - 16px);}
.refresh-btn:hover{border-color:#8C7B80;color:#8C7B80;}
.clist{flex:1;overflow-y:auto;padding:6px;}
.crow{padding:9px 10px;border-radius:8px;cursor:pointer;margin-bottom:3px;border:1px solid transparent;transition:all .12s;}
.crow:hover{background:#f9f8f8;border-color:#eee;}
.crow.on{background:#f3efef;border-color:#8C7B80;}
.crow-top{display:flex;align-items:center;gap:8px;margin-bottom:3px;}
.av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}
.crow-name{font-size:12px;font-weight:600;flex:1;}
.crow-sub{font-size:10px;color:#999;margin-left:36px;}
