window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};
const obterDados = window.obterDados;
const salvarDados = window.salvarDados;

let todosCuponsAgrupados = [];
let cupomSelecionadoAtual = null;

document.addEventListener("DOMContentLoaded", carregarEAgruparCupons);
document.addEventListener("dadosAtualizados", carregarEAgruparCupons);
document.addEventListener("bancoPronto", carregarEAgruparCupons);
if (window.isBancoPronto) carregarEAgruparCupons();

function converterDataISOparaBR(dataIso) {
    if (!dataIso) return "--/--/----";
    if (dataIso.includes("/")) return dataIso;
    const p = dataIso.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : dataIso;
}

function carregarEAgruparCupons() {
    const movimentacoes = obterDados("movimentacoes") || {};
    const mapaCupons = {};
    const datas = Object.keys(movimentacoes).sort();

    datas.forEach(dia => {
        const lista = movimentacoes[dia] || [];
        let contadorDia = 1;
        const numPedidoMap = {};

        lista.forEach(venda => {
            if (!venda.idCupom) return;

            if (!numPedidoMap[venda.idCupom]) {
                numPedidoMap[venda.idCupom] = venda.numeroPedido
                    ? String(venda.numeroPedido).padStart(2, '0')
                    : String(contadorDia++).padStart(2, '0');
            }

            const id = venda.idCupom;
            if (!mapaCupons[id]) {
                mapaCupons[id] = {
                    idCupom: id,
                    numeroPedido: venda.numeroPedido || null,
                    numeroPedidoFormatado: numPedidoMap[id],
                    data: venda.data || dia,
                    hora: venda.hora || "--:--",
                    operador: venda.usuario || "Operador",
                    formaPagamento: venda.formaPagamento || "Dinheiro",
                    cliente: venda.cliente || "",       
                    observacao: venda.observacao || "", 
                    valorRecebido: venda.valorRecebido !== undefined ? venda.valorRecebido : null,
                    status: "venda",
                    itens: [],
                    total: 0
                };
            }

            const cp = mapaCupons[id];
            if (venda.tipoMovimento === 'cancelamento_total' || venda.tipoMovimento === 'cancelado') cp.status = 'cancelado';
            else if (venda.tipoMovimento === 'devolucao') cp.status = 'devolucao';
            else if (venda.tipoMovimento === 'descarte') cp.status = 'descarte';

            if (venda.tipoMovimento === 'venda' || (parseFloat(venda.quantidade) || 0) > 0) {
                cp.itens.push({
                    codigo: venda.codigo,
                    nome: venda.produto,
                    quantidade: parseFloat(venda.quantidade) || 0,
                    valor: parseFloat(venda.valor) || 0
                });
            }
        });
    });

    Object.values(mapaCupons).forEach(cp => {
        if (cp.status === 'cancelado') { cp.total = 0; return; }
        let s = 0;
        cp.itens.forEach(it => { s += it.valor * it.quantidade; });
        cp.total = s;
    });

    const arr = Object.values(mapaCupons);
    arr.sort((a, b) => {
        if (a.data !== b.data) return b.data.localeCompare(a.data);
        return parseInt(b.numeroPedidoFormatado) - parseInt(a.numeroPedidoFormatado);
    });

    todosCuponsAgrupados = arr.slice(0, 200);
    renderizarListaCupons(todosCuponsAgrupados);

    if (cupomSelecionadoAtual) {
        const atual = todosCuponsAgrupados.find(c => c.idCupom === cupomSelecionadoAtual.idCupom);
        if (atual) exibirDetalhesCupom(atual);
    }
}

function renderizarListaCupons(lista) {
    const container = document.getElementById("container-lista-cupons");
    if (!container) return;
    container.innerHTML = "";

    if (!lista.length) {
        container.innerHTML = `
            <div style="text-align: center; grid-column: 1/-1; padding: 40px; color: #7f8c8d;">
                <h1 style="font-size: 40px; margin: 0; margin-bottom: 10px;">📭</h1>
                <h3 style="margin: 0;">Nenhum cupom encontrado.</h3>
                <p>Tente buscar por outro número ou data.</p>
            </div>`;
        return;
    }

    let dataHeaderAtual = "";
    lista.forEach(cupom => {
        const dataBR = converterDataISOparaBR(cupom.data);
        if (dataBR !== dataHeaderAtual) {
            const h = document.createElement("div");
            h.style.cssText = "grid-column:1/-1; font-size:15px; font-weight:800; color:#34495e; margin-top:20px; padding-bottom:8px; border-bottom:2px solid #bdc3c7; display: flex; align-items: center; gap: 8px;";
            h.innerHTML = `📅 Vendas de ${dataBR}`;
            container.appendChild(h);
            dataHeaderAtual = dataBR;
        }

        const isCancelado = cupom.status === "cancelado";
        const div = document.createElement("div");
        div.className = "card-cupom" + (isCancelado ? " cancelado" : "");

        const badgeHTML = isCancelado ? `<span class='badge badge-cancel'>❌ Cancelado</span>` : `<span class='badge badge-ok'>✅ Concluído</span>`;
        const corValor = isCancelado ? "#7f8c8d" : "#27ae60";
        const exibirTotal = isCancelado ? "<del>R$ " + cupom.itens.reduce((s, i) => s + (i.valor * i.quantidade), 0).toFixed(2) + "</del>" : "R$ " + cupom.total.toFixed(2);
        const txtCliente = cupom.cliente ? `<p class="card-info-row">👤 ${cupom.cliente}</p>` : `<p class="card-info-row">👤 Balcão</p>`;

        div.innerHTML = `
            <div class="card-header-row">
                <h4>📦 #${cupom.numeroPedidoFormatado}</h4>
                ${badgeHTML}
            </div>
            ${txtCliente}
            <p class="card-info-row">🕒 ${cupom.hora} &nbsp;|&nbsp; 💳 ${cupom.formaPagamento}</p>
            <p class="card-info-row">👨‍💻 Op: ${cupom.operador}</p>
            <div class="card-total" style="color: ${corValor};">${exibirTotal}</div>
        `;

        div.onclick = () => exibirDetalhesCupom(cupom);
        container.appendChild(div);
    });
}

function filtrarCupons() {
    const txt = (document.getElementById("inputBuscarCupom").value || "").trim().toUpperCase();
    const dt  = document.getElementById("inputFiltrarData").value;

    const filtrados = todosCuponsAgrupados.filter(c => {
        let okT = true, okD = true;
        if (txt) {
            okT = c.idCupom.toUpperCase().includes(txt) ||
                  c.numeroPedidoFormatado.includes(txt) ||
                  (c.cliente && c.cliente.toUpperCase().includes(txt)); 
        }
        if (dt) okD = (c.data === dt);
        return okT && okD;
    });

    renderizarListaCupons(filtrados);
    if (filtrados.length === 1) exibirDetalhesCupom(filtrados[0]);
}

function limparBuscaCupom() {
    document.getElementById("inputBuscarCupom").value = "";
    document.getElementById("inputFiltrarData").value = "";
    renderizarListaCupons(todosCuponsAgrupados);
    
    document.getElementById("resultado-cupom-content").innerHTML = `
        <div style='text-align:center; color:#7f8c8d; background:#fff; padding:40px 20px; border-radius:12px; border:2px dashed #bdc3c7; width: 100%;'>
            <h1 style="font-size: 40px; margin: 0; margin-bottom: 10px;">🖱️️</h1>
            <h3 style="margin: 0; color: #34495e;">Nenhum cupom selecionado</h3>
            <p style="font-size: 14px;">Clique em um pedido na lista ao lado para visualizar os detalhes, imprimir uma segunda via ou realizar o cancelamento.</p>
        </div>`;
    cupomSelecionadoAtual = null;
}

// ==========================================
// GERADOR UNIFICADO DE HTML DO CUPOM (PREVIEW E IMPRESSÃO)
// ==========================================
function gerarHtmlCupomString(cupom) {
    let config = obterDados('configEmpresa') || {};
    let nomeEmpresa = config.nomeCabecalho || "NOME DA LOJA";
    
    let is80mm = config.tamanhoImpressora === '80';
    let maxLargura = is80mm ? '280px' : '200px'; 
    let fonteNormal = is80mm ? '14px' : '12px';
    let fontePequena = is80mm ? '12px' : '10px';
    let fonteTitulo = is80mm ? '18px' : '15px';
    let margemInterna = is80mm ? '4mm' : '2mm';

    let operador = cupom.operador || "admin";
    let dataHora = converterDataISOparaBR(cupom.data) + " " + (cupom.hora || "");
    let numCupom = cupom.idCupom ? cupom.idCupom.replace(/\D/g, '').substring(0, 13) : "000000";

    let linhaPedidoHtml = '';
    let exibePedido = (config.usarNumeroPedido === true || config.usarNumeroPedido === undefined || String(config.usarNumeroPedido) === "true");
    
    if (exibePedido && cupom.numeroPedidoFormatado) {
        linhaPedidoHtml = `
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="text-align: center; font-size: ${is80mm ? '26px' : '22px'}; font-weight: 900; margin: 8px 0; border: 2px dashed #000; padding: 4px;">
            PEDIDO: ${cupom.numeroPedidoFormatado}
        </div>`;
    }

    let clienteHtml = '';
    if (cupom.cliente) {
        clienteHtml = `<div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div><div style="display: flex; justify-content: space-between; width: 100%;"><span>CLIENTE:</span><span>${cupom.cliente.toUpperCase()}</span></div>`;
    }

    let subtotalBruto = 0;
    let itensHtml = '';
    cupom.itens.forEach(item => {
        let limiteCaracteres = is80mm ? 22 : 16;
        let desc = (item.nome || "").substring(0, limiteCaracteres); 
        let subtotalItem = item.valor * item.quantidade;
        subtotalBruto += subtotalItem;
        itensHtml += `<tr><td style="text-align: center; width: 15%;">${item.quantidade}</td><td style="text-align: left; width: 55%; padding-left: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desc}</td><td style="text-align: right; width: 30%;">${parseFloat(subtotalItem).toFixed(2)}</td></tr>`;
    });

    let descontoCalculado = subtotalBruto - parseFloat(cupom.total);
    let linhaDescontoHtml = '';
    if (descontoCalculado > 0.01) {
        linhaDescontoHtml = `
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="display: flex; justify-content: space-between; width: 100%;"><span>SUBTOTAL:</span><span>R$ ${subtotalBruto.toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between; width: 100%;"><span>DESCONTO:</span><span>- R$ ${descontoCalculado.toFixed(2)}</span></div>`;
    }

    let trocoCupomHtml = '';
    if (cupom.formaPagamento && cupom.formaPagamento.toLowerCase() === 'dinheiro' && cupom.valorRecebido && cupom.valorRecebido > 0) {
        let calcTroco = Math.max(0, cupom.valorRecebido - parseFloat(cupom.total));
        trocoCupomHtml = `
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="display: flex; justify-content: space-between; width: 100%;"><span>VALOR RECEBIDO:</span><span>R$ ${parseFloat(cupom.valorRecebido).toFixed(2)}</span></div>
        <div style="display: flex; justify-content: space-between; width: 100%;"><span>TROCO:</span><span>R$ ${calcTroco.toFixed(2)}</span></div>`;
    }

    const isCancelado = cupom.status === "cancelado";
    const tituloCupomText = isCancelado ? "*** CANCELADO ***" : "CUPOM NÃO FISCAL";

    return `
    <div style="
        font-family: 'Courier New', Courier, monospace; 
        max-width: ${maxLargura};
        margin: 0 auto;
        padding: ${margemInterna}; 
        font-size: ${fonteNormal}; 
        color: #000; 
        font-weight: 900; 
        box-sizing: border-box;
        background: #fff;
        border: 1px solid #ccc;
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
        position: relative;
        text-align: left;
    ">
        <div style="text-align: center;">
            <h2 style="margin: 0; font-size: ${fonteTitulo}; font-weight: 900; text-transform: uppercase;">${nomeEmpresa}</h2>
        </div>
        ${linhaPedidoHtml}
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="text-align: center;">${tituloCupomText}</div>
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div>Data: ${dataHora}</div>
        <div style="display: flex; justify-content: space-between; width: 100%;"><span>Op: ${operador}</span><span>Cp: ${numCupom.substring(numCupom.length - 6)}</span></div>
        ${clienteHtml}
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <table style="width: 100%; border-collapse: collapse; margin: 6px 0;">
            <tr style="font-weight: 900; font-size: ${fonteNormal};"><th style="text-align: center; width: 15%;">QTD</th><th style="text-align: left; width: 55%; padding-left: 4px;">DESC</th><th style="text-align: right; width: 30%;">TOT</th></tr>
            <tr><td colspan="3"><div style="border-top: 1px dashed #000; margin: 3px 0; width: 100%;"></div></td></tr>
            ${itensHtml}
        </table>
        ${linhaDescontoHtml}
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="display: flex; justify-content: space-between; width: 100%; font-size: ${is80mm ? '18px' : '15px'}; margin: 6px 0; align-items: center;"><span>TOTAL:</span><span>R$ ${parseFloat(cupom.total).toFixed(2)}</span></div>
        ${trocoCupomHtml}
        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="display: flex; justify-content: space-between; width: 100%;"><span>PAGTO:</span><span>${(cupom.formaPagamento || "").toUpperCase()}</span></div>
        
        ${cupom.observacao ? `<div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div><div><span style="font-size: ${fontePequena};">Obs: ${cupom.observacao}</span></div>` : ''}

        <div style="border-top: 1px dashed #000; margin: 6px 0; width: 100%;"></div>
        <div style="text-align: center; margin-top: 10px;">
            <p style="margin: 3px 0;">Obrigado!</p>
            <p style="margin: 3px 0;">Volte Sempre!</p>
        </div>
    </div>`;
}

function exibirDetalhesCupom(cupom) {
    cupomSelecionadoAtual = cupom;
    const content = document.getElementById("resultado-cupom-content");
    if (!content) return;

    const isCancelado = cupom.status === "cancelado";
    let html = gerarHtmlCupomString(cupom);

    html += "<div class='botoes-cupom-acoes'>";
    html += "<button onclick='reimprimirCupomCentral()' style='background-color:#2980b9; color:white;'>🖨️ Imprimir 2ª Via</button>";
    if (!isCancelado) {
        html += "<button onclick='cancelarCupomCentral()' style='background-color:#e74c3c; color:white;'>🗑️ Cancelar Venda</button>";
    }
    html += "</div>";

    content.innerHTML = html;
}

function reimprimirCupomCentral() {
    if (!cupomSelecionadoAtual) return;
    const iframe = document.getElementById("iframe-impressao");
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    let config = obterDados('configEmpresa') || {};
    let is80mm = config.tamanhoImpressora === '80';
    let tamanhoPapel = is80mm ? '80mm' : '58mm';

    const corpoCupomHtml = gerarHtmlCupomString(cupomSelecionadoAtual);

    const htmlStr = `
    <html>
    <head>
    <style>
        @page { size: ${tamanhoPapel} auto; margin: 0; }
        body { margin: 0; padding: 0; background: #fff; }
    </style>
    </head>
    <body>
        ${corpoCupomHtml}
        <script>setTimeout(() => { window.print(); }, 800);<\/script>
    </body>
    </html>`;

    doc.open(); doc.write(htmlStr); doc.close();
    setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); }, 400);
}

function cancelarCupomCentral() {
    if (!cupomSelecionadoAtual) return;
    const senhaAdmin = prompt("🔐 Digite a Senha Master do Sistema para cancelar a venda:");
    
    const senhasSys = obterDados("senhasSistema") || { master: "1996" };
    if (senhaAdmin !== senhasSys.master) { alert("Senha incorreta!"); return; }

    const devolverEstoque = confirm("Devolver produtos ao estoque?");
    const movimentacoes = obterDados("movimentacoes") || {};
    const produtosDoEstoque = obterDados("produtos") || {};
    const resumoFormas = obterDados("resumoFormas") || { Pix:0, Crédito:0, Débito:0, Dinheiro:0, Cheque:0, VR:0, Misto:0 };

    const dataVenda = cupomSelecionadoAtual.data;
    const idVenda = cupomSelecionadoAtual.idCupom;

    if (movimentacoes[dataVenda]) {
        movimentacoes[dataVenda].forEach(mv => {
            if (mv.idCupom === idVenda) {
                mv.tipoMovimento = "cancelado";
                if (devolverEstoque) {
                    const cod = mv.codigo;
                    const qtd = parseInt(mv.quantidade) || 0;
                    if (produtosDoEstoque[cod]) produtosDoEstoque[cod].quantidade += qtd;
                }
            }
        });

        const forma = cupomSelecionadoAtual.formaPagamento;
        if (resumoFormas[forma] !== undefined) {
            resumoFormas[forma] = Math.max(0, resumoFormas[forma] - cupomSelecionadoAtual.total);
        }

        salvarDados("movimentacoes", movimentacoes);
        salvarDados("resumoFormas", resumoFormas);
        if (devolverEstoque) salvarDados("produtos", produtosDoEstoque);

        alert("✅ Pedido cancelado!");
        carregarEAgruparCupons();
    }
}

window.filtrarCupons = filtrarCupons;
window.limparBuscaCupom = limparBuscaCupom;
window.reimprimirCupomCentral = reimprimirCupomCentral;
window.cancelarCupomCentral = cancelarCupomCentral;
