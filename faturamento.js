// faturamento.js

window.dadosRelatorioAtual = [];

var formatarData = function(data) {
  var ano = data.getFullYear();
  var mes = String(data.getMonth() + 1).padStart(2, '0');
  var dia = String(data.getDate()).padStart(2, '0');
  return ano + "-" + mes + "-" + dia;
};

function setarDatasPadrao() {
  var hoje = new Date();
  var primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  var inputInicio = document.getElementById("dataInicio");
  var inputFim = document.getElementById("dataFim");

  if (inputInicio) inputInicio.value = formatarData(primeiroDiaMes);
  if (inputFim) inputFim.value = formatarData(hoje);
}

function normalizarFormaPag(valor) {
  if (!valor) return 'Outro';
  var v = String(valor).toLowerCase().trim();
  if (v.indexOf('dinheiro') !== -1) return 'Dinheiro';
  if (v.indexOf('pix') !== -1) return 'Pix';
  if (v.indexOf('credito') !== -1 || v.indexOf('crédito') !== -1) return 'Credito';
  if (v.indexOf('debito') !== -1 || v.indexOf('débito') !== -1) return 'Debito';
  return 'Outro';
}

function rotuloFormaPag(chave) {
  switch (chave) {
    case 'Dinheiro': return 'Dinheiro';
    case 'Pix': return 'Pix';
    case 'Credito': return 'Crédito';
    case 'Debito': return 'Débito';
    default: return 'Outro';
  }
}

function abrirModalGasto() {
  var modal = document.getElementById('modal-gasto');
  if (modal) modal.style.display = 'flex';
  
  var inputDataGasto = document.getElementById('g-data');
  if (inputDataGasto) inputDataGasto.value = formatarData(new Date());
  
  document.getElementById('g-desc').value = '';
  document.getElementById('g-val').value = '';
  var sel = document.getElementById('g-forma-pag');
  if (sel) sel.value = 'Dinheiro';
}

function fecharModalGasto() {
  var modal = document.getElementById('modal-gasto');
  if (modal) modal.style.display = 'none';
}

function salvarGasto() {
  var desc = document.getElementById('g-desc').value.trim();
  var valor = parseFloat(document.getElementById('g-val').value);
  var data = document.getElementById('g-data').value;
  var formaPagSel = document.getElementById('g-forma-pag');
  var formaPag = formaPagSel ? formaPagSel.value : 'Dinheiro';

  if (!desc || isNaN(valor) || valor <= 0 || !data) {
    alert("Preencha todos os campos corretamente!");
    return;
  }

  var movimentacoes = window.obterDados ? (window.obterDados("movimentacoes") || {}) : {};
  if (!movimentacoes[data]) {
    movimentacoes[data] = [];
  }

  var horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  movimentacoes[data].push({
    tipoMovimento: 'gasto',
    produto: desc,
    valor: valor,
    quantidade: 1, 
    hora: horaAtual,
    formaPagamento: formaPag
  });

  if (window.salvarDados) {
      window.salvarDados("movimentacoes", movimentacoes);
      alert("Despesa registrada com sucesso na Nuvem!");
  } else {
      alert("Erro ao conectar com a nuvem, despesa não salva.");
  }

  fecharModalGasto();
  gerarRelatorio();
}

function verDespesas(indexArray) {
    var dia = window.dadosRelatorioAtual[indexArray];
    var modal = document.getElementById("modal-ver-despesas");
    var tbody = document.getElementById("corpo-tabela-despesas");

    document.getElementById("titulo-data-despesas").innerText = dia.dataAmigavel;
    tbody.innerHTML = "";

    dia.listaDeGastos.forEach(function(gasto) {
        var tr = document.createElement("tr");
        var valorGasto = parseFloat(gasto.valor) || 0;
        var descricaoGasto = gasto.produto || "Despesa não detalhada";
        var chaveForma = normalizarFormaPag(gasto.formaPagamento);
        var badge = "<span class='badge-pag badge-" + chaveForma + "'>" + rotuloFormaPag(chaveForma) + "</span>";

        tr.innerHTML = "<td>" + (gasto.hora || "--:--") + "</td>" +
                       "<td>" + descricaoGasto + "</td>" +
                       "<td>" + badge + "</td>" +
                       "<td style='color:#ef4444; font-weight:bold; text-align:right;'>R$ " + valorGasto.toFixed(2).replace('.', ',') + "</td>";
        tbody.appendChild(tr);
    });

    modal.style.display = "flex";
}

function fecharModalVerDespesas() {
    document.getElementById("modal-ver-despesas").style.display = "none";
}

function gerarRelatorio() {
  var inicio = document.getElementById("dataInicio").value;
  var fim = document.getElementById("dataFim").value;
  
  if (!inicio || !fim) {
    alert("Por favor, defina a Data Início e a Data Fim.");
    return;
  }

  var dataFimObj = new Date(fim + "T12:00:00"); 
  dataFimObj.setDate(dataFimObj.getDate() + 1);
  var fimSeguro = formatarData(dataFimObj);

  var tbody = document.getElementById("corpo-tabela");
  var totalSpan = document.getElementById("valor-total");
  var caixaTotal = document.getElementById("caixa-total");
  var cardBruto = document.getElementById("total-bruto-geral");
  var cardCusto = document.getElementById("total-custo-geral");
  var cardDespesas = document.getElementById("total-despesas-geral");
  
  if (!tbody || !totalSpan || !caixaTotal) return;

  tbody.innerHTML = ""; 
  
  var somaBrutoGeral = 0;
  var somaCustoGeral = 0;
  var somaDespesasGeral = 0;
  var totalLiquidoGeral = 0;

  var movimentacoes = window.obterDados ? (window.obterDados("movimentacoes") || {}) : {};
  var produtosBD = window.obterDados ? (window.obterDados("produtos") || {}) : {};
  var resumoDiario = {};

  var chavesMov = Object.keys(movimentacoes);
  for (var k = 0; k < chavesMov.length; k++) {
    var dataStr = chavesMov[k];
    var dataComparavel = dataStr;

    if (dataStr.includes('/')) {
      var partes = dataStr.split('/');
      if (partes.length === 3) {
        dataComparavel = partes[2] + "-" + partes[1] + "-" + partes[0];
      }
    }

    if (dataComparavel >= inicio && dataComparavel <= fimSeguro) {
      if (!resumoDiario[dataComparavel]) {
        var partesData = dataComparavel.split('-');
        var dataAmigavel = partesData.length === 3 ? partesData[2] + "/" + partesData[1] + "/" + partesData[0] : dataComparavel;
        resumoDiario[dataComparavel] = { 
          bruto: 0, 
          custoProdutos: 0, 
          despesas: 0, 
          liquido: 0, 
          dataAmigavel: dataAmigavel, 
          dataISO: dataComparavel, 
          listaDeGastos: [] 
        };
      }

      movimentacoes[dataStr].forEach(function(mov) {
        var tipo = mov.tipoMovimento ? mov.tipoMovimento.toLowerCase() : 'venda';
        var vlrVenda = mov.valor ? parseFloat(mov.valor) : 0;
        var qtd = (mov.quantidade !== undefined && mov.quantidade !== null) ? Math.abs(mov.quantidade) : 1;
        var valorTotalVendaItem = vlrVenda * qtd;

        if (tipo === 'cancelado') {
             return;
        }

        if (tipo === 'gasto' || tipo === 'despesa' || tipo === 'saída' || tipo === 'saida' || tipo === 'sangria') {
          resumoDiario[dataComparavel].despesas += valorTotalVendaItem;
          resumoDiario[dataComparavel].listaDeGastos.push(mov); 
        } else {
          // É uma venda: calcula o bruto e busca o custo unitário do produto cadastrado
          resumoDiario[dataComparavel].bruto += valorTotalVendaItem;

          var custoUnitario = 0;
          if (mov.codigo && produtosBD[mov.codigo] && produtosBD[mov.codigo].custo !== undefined) {
            custoUnitario = parseFloat(produtosBD[mov.codigo].custo) || 0;
          } else if (mov.produto) {
            // Tenta encontrar pelo nome caso não tenha código salvo
            var nomeMov = mov.produto.toLowerCase().trim();
            for (var c in produtosBD) {
              if (produtosBD[c].nome && produtosBD[c].nome.toLowerCase().trim() === nomeMov) {
                custoUnitario = parseFloat(produtosBD[c].custo) || 0;
                break;
              }
            }
          }

          resumoDiario[dataComparavel].custoProdutos += (custoUnitario * qtd);
        }
      });

      resumoDiario[dataComparavel].liquido = resumoDiario[dataComparavel].bruto - resumoDiario[dataComparavel].custoProdutos - resumoDiario[dataComparavel].despesas;
    }
  }

  var diasFiltrados = Object.keys(resumoDiario).map(function(ch) { return resumoDiario[ch]; });
  diasFiltrados.sort(function(a, b) {
    return new Date(b.dataISO) - new Date(a.dataISO);
  });

  window.dadosRelatorioAtual = diasFiltrados;

  if (diasFiltrados.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6' style='text-align: center; color: #64748b; padding: 20px;'>Nenhum faturamento ou gasto encontrado neste período.</td></tr>";
    totalSpan.innerText = "R$ 0,00";
    if (cardBruto) cardBruto.innerText = "R$ 0,00";
    if (cardCusto) cardCusto.innerText = "R$ 0,00";
    if (cardDespesas) cardDespesas.innerText = "R$ 0,00";
    caixaTotal.className = "total-faturamento";
    return;
  }

  diasFiltrados.forEach(function(dia, index) {
    somaBrutoGeral += dia.bruto;
    somaCustoGeral += dia.custoProdutos;
    somaDespesasGeral += dia.despesas;
    totalLiquidoGeral += dia.liquido;

    var tr = document.createElement("tr");
    var estiloCorLiquido = dia.liquido >= 0 ? "color: #10b981; font-weight: bold;" : "color: #ef4444; font-weight: bold;";

    var botaoVerDespesas = dia.listaDeGastos.length > 0 
        ? "<button onclick='verDespesas(" + index + ")' style='background:#f39c12; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; transition:0.2s;'>🔍 Ver (" + dia.listaDeGastos.length + ")</button>"
        : "<span style='color:#95a5a6; font-size:13px;'>Nenhuma</span>";

    tr.innerHTML = "<td>" + dia.dataAmigavel + "</td>" +
                   "<td style='color: #00a2ff; font-weight: 500;'>R$ " + dia.bruto.toFixed(2).replace('.', ',') + "</td>" +
                   "<td style='color: #f59e0b;'>R$ " + dia.custoProdutos.toFixed(2).replace('.', ',') + "</td>" +
                   "<td style='color: #ef4444;'>R$ " + dia.despesas.toFixed(2).replace('.', ',') + "</td>" +
                   "<td style='" + estiloCorLiquido + "'>R$ " + dia.liquido.toFixed(2).replace('.', ',') + "</td>" +
                   "<td>" + botaoVerDespesas + "</td>";
    tbody.appendChild(tr);
  });

  if (cardBruto) cardBruto.innerText = "R$ " + somaBrutoGeral.toFixed(2).replace('.', ',');
  if (cardCusto) cardCusto.innerText = "R$ " + somaCustoGeral.toFixed(2).replace('.', ',');
  if (cardDespesas) cardDespesas.innerText = "R$ " + somaDespesasGeral.toFixed(2).replace('.', ',');
  totalSpan.innerText = "R$ " + totalLiquidoGeral.toFixed(2).replace('.', ',');
  
  if (totalLiquidoGeral < 0) {
    caixaTotal.className = "total-faturamento negativo";
  } else {
    caixaTotal.className = "total-faturamento";
  }
}

document.addEventListener("bancoPronto", function() {
  setarDatasPadrao();
  gerarRelatorio();
});

document.addEventListener("dadosAtualizados", function() {
  gerarRelatorio();
});

if (window.isBancoPronto) {
  setarDatasPadrao();
  gerarRelatorio();
}