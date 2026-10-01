window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};

// ==========================================
// CONTROLO DE CAIXA INDIVIDUAL E SEGURANÇA
// ==========================================
window.obterChaveCaixa = function(chaveBase) {
    const usuario = sessionStorage.getItem("usuarioLogado") || "Admin";
    return "caixa_" + chaveBase + "_" + usuario;
};

window.isCaixaAberto = function() {
    var chave = window.obterChaveCaixa("aberto_status");
    var dbVal = window.obterDados(chave);
    var localVal = localStorage.getItem(chave);
    return dbVal === "ABERTO" || localVal === "ABERTO";
};

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

function tocarBipe() {
    try {
        var context = new (window.AudioContext || window.webkitAudioContext)();
        var oscillator = context.createOscillator();
        var gainNode = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 850;
        gainNode.gain.setValueAtTime(0.1, context.currentTime);
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start();
        setTimeout(function() { oscillator.stop(); }, 120);
    } catch(e) { console.log("Áudio não suportado"); }
}

window.fecharModalAvisoGlobal = function() {
    var m = document.getElementById("modalAvisoSistema");
    if (m) m.style.display = 'none';
    var cb = document.getElementById("codigo-barra");
    if (cb && window.isCaixaAberto()) cb.focus();
};

window.mostrarAvisoModal = function(mensagem, titulo = "Atenção") {
    let tituloEl = document.getElementById("tituloAvisoModal");
    let msgEl = document.getElementById("mensagemAvisoModal");
    let modalEl = document.getElementById("modalAvisoSistema");
    
    if (tituloEl && msgEl && modalEl) {
        tituloEl.innerText = titulo;
        msgEl.innerText = mensagem; 
        modalEl.style.display = "flex";
        
        modalEl.dataset.bloqueado = "true";
        setTimeout(() => { modalEl.dataset.bloqueado = "false"; }, 300);
        
        let btnOk = modalEl.querySelector('button');
        if(btnOk) setTimeout(() => { btnOk.focus(); }, 100);
    } else {
        alert(titulo + "\n\n" + mensagem); 
    }
};

window.mostrarAvisoEstoque = function(nomeProduto, qtdRestante) {
    window.mostrarAvisoModal(`O produto "${nomeProduto}" está com o estoque crítico, zerado ou negativo!\n\nQuantidade Restante no Sistema: ${qtdRestante} un.`, "⚠️ Alerta de Estoque");
};

let vendaAtual = [];
let totalVenda = 0;
let resumoFormas = { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Fiado: 0, Misto: 0 };
let itemPendenteDeAdicao = null;
let fidelidadePerguntada = false;
let clienteFidelidadeAtual = null;
let brindeFidelidadeConcedido = false; 
let clienteFiadoAtual = null;
let aguardandoConfirmacaoFiado = false;
let indexSugestaoAtual = -1;
let vendaPendenteInfo = null; 

document.addEventListener("DOMContentLoaded", function() {
    var displayHorario = document.getElementById("display-horario");
    if (displayHorario) {
        setInterval(() => {
            var agora = new Date();
            displayHorario.innerText = agora.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
        }, 1000);
    }
    var txtOperador = document.getElementById("display-operador");
    if (txtOperador) txtOperador.innerText = sessionStorage.getItem("usuarioLogado") || "Admin";

    atualizarTopBar();
});

function atualizarTopBar() {
    var isAberto = window.isCaixaAberto();
    
    var elStatus = document.getElementById('display-status-caixa');
    var elBloqueio = document.getElementById('bloqueio-tela');
    
    if (elStatus) {
        elStatus.innerText = isAberto ? "Aberto" : "Fechado";
        elStatus.style.color = isAberto ? "#27ae60" : "#c0392b";
    }
    
    if (elBloqueio) {
        if (!isAberto) {
            elBloqueio.style.display = 'flex';
            elBloqueio.style.position = 'fixed';
            elBloqueio.style.top = '0';
            elBloqueio.style.left = '0';
            elBloqueio.style.width = '100vw';
            elBloqueio.style.height = '100vh';
            elBloqueio.style.backgroundColor = 'rgba(0,0,0,0.95)';
            elBloqueio.style.zIndex = '9998'; 
            elBloqueio.style.flexDirection = 'column';
            elBloqueio.style.alignItems = 'center';
            elBloqueio.style.justifyContent = 'center';
            elBloqueio.style.color = 'white';
        } else {
            elBloqueio.style.display = 'none';
        }
    }
}

function inicializarCaixaCompleto() {
    var r = window.obterDados("resumoFormas");
    if(r) { resumoFormas = { ...resumoFormas, ...r }; }
    var configSalva = window.obterDados("configLoja") || {};
    var configEmpresa = window.obterDados("configEmpresa") || {};
    var nomeExibir = configEmpresa.nomeCabecalho || configSalva.nome || "NOME DA EMPRESA";
    var txtNomeLoja = document.getElementById("display-nome-loja");
    if (txtNomeLoja) txtNomeLoja.innerText = nomeExibir;

    var modSaaS = JSON.parse(localStorage.getItem('saas_modulos') || "{}");
    var usarFiadoConfig = configEmpresa.usarFiado !== false;
    var usarFiadoSaaS = modSaaS.mod_fiado !== false;
    var fiadoHabilitado = usarFiadoConfig && usarFiadoSaaS;

    var opFiadoModal = document.getElementById("opcao-pagamento-fiado");
    if (opFiadoModal) opFiadoModal.style.display = fiadoHabilitado ? "block" : "none";

    var linhaFiadoMisto = document.getElementById("linha-pg-fiado");
    if (linhaFiadoMisto) linhaFiadoMisto.style.display = fiadoHabilitado ? "block" : "none";
}

if (window.isBancoPronto) { 
    inicializarCaixaCompleto(); 
    atualizarTopBar();
} else { 
    document.addEventListener('bancoPronto', function() {
        inicializarCaixaCompleto();
        atualizarTopBar();
    }); 
}

document.addEventListener('dadosAtualizados', function() {
    atualizarTopBar();
});

function fecharModal(id) { document.getElementById(id).style.display = 'none'; }

function atualizarResumoVenda() {
    document.getElementById("total-geral").innerText = totalVenda.toFixed(2);
    document.getElementById("total-geral-lado").innerText = totalVenda.toFixed(2);
    var descontoTotalElement = document.getElementById('desconto-valor-total-venda');
    if (descontoTotalElement) descontoTotalElement.innerText = totalVenda.toFixed(2);
}

function adicionarAoCarrinhoComRegraFidelidade(codigo, nome, valorOriginal, quantidade) {
    let configEmp = window.obterDados("configEmpresa") || {};
    let meta = configEmp.fidelidadeMeta || 10;
    let brindeNome = configEmp.fidelidadeBrinde || "";
    let isEligible = clienteFidelidadeAtual && (clienteFidelidadeAtual.dados.compras >= meta);
    let isRewardProduct = (nome === brindeNome);

    if (isEligible && isRewardProduct && !brindeFidelidadeConcedido) {
        brindeFidelidadeConcedido = true;
        if (quantidade > 1) {
            vendaAtual.push({ codigo: codigo, nome: "🎁 [BRINDE] " + nome, valor: 0, quantidade: 1 });
            vendaAtual.push({ codigo: codigo, nome: nome, valor: valorOriginal, quantidade: quantidade - 1 });
        } else {
            vendaAtual.push({ codigo: codigo, nome: "🎁 [BRINDE] " + nome, valor: 0, quantidade: 1 });
        }
    } else {
        vendaAtual.push({ codigo: codigo, nome: nome, valor: valorOriginal, quantidade: quantidade });
    }
}

window.adicionarItemVenda = function() {
    if (!window.isCaixaAberto()) return window.mostrarAvisoModal("O Caixa está fechado!");

    var inputEl = document.getElementById("codigo-barra");
    var inputVal = inputEl.value.trim();
    var qtdInput = parseInt(document.getElementById("quantidade-produto").value.trim());
    var quantidade = isNaN(qtdInput) || qtdInput <= 0 ? 1 : qtdInput;
    
    var produtosNaNuvem = window.obterDados("produtos") || {};
    var configEmp = window.obterDados("configEmpresa") || {};

    if (!inputVal) return;
    var codigoEncontrado = null;

    if (produtosNaNuvem[inputVal]) {
        codigoEncontrado = inputVal;
    } else if (configEmp.usarBuscaNome === true) {
        var lowerInput = inputVal.toLowerCase();
        for (var key in produtosNaNuvem) {
            if (produtosNaNuvem[key].nome && produtosNaNuvem[key].nome.toLowerCase() === lowerInput) {
                codigoEncontrado = key;
                break;
            }
        }
    }

    if (!codigoEncontrado) {
        if (configEmp.usarBuscaNome !== true && /^\D+$/.test(inputVal)) {
            document.getElementById("codigo-barra").value = "";
            return window.mostrarAvisoModal("A pesquisa de produtos pelo nome está desativada nas configurações do sistema.", "Acesso Negado");
        }
        document.getElementById("codigo-barra").value = "";
        return window.mostrarAvisoModal("Produto não encontrado no sistema.", "Não Encontrado");
    }

    var produtoObj = produtosNaNuvem[codigoEncontrado];
    var qtdNoCarrinho = 0;
    vendaAtual.forEach(item => {
        if (item.codigo === codigoEncontrado && !item.nome.startsWith("🎁 [BRINDE]")) {
            qtdNoCarrinho += item.quantidade;
        }
    });

    var estoqueAtual = parseInt(produtoObj.quantidade) || 0;
    var estoqueRestanteCalculado = estoqueAtual - (quantidade + qtdNoCarrinho);

    if (estoqueRestanteCalculado < 0) {
        if (configEmp.usarEstoqueNegativo !== true) {
            document.getElementById("codigo-barra").value = "";
            document.getElementById("codigo-barra").focus();
            window.mostrarAvisoModal(`🚫 VENDA BLOQUEADA!\n\n• Estoque Atual: ${estoqueAtual} un\n• Já no Carrinho: ${qtdNoCarrinho} un\n• Tentando adicionar: ${quantidade} un\n\nA opção de vender sem estoque ou com estoque negativo está desativada no sistema.`, "Estoque Insuficiente");
            return;
        }
    }

    tocarBipe();
    inputEl.style.backgroundColor = "#c8e6c9"; 
    setTimeout(() => inputEl.style.backgroundColor = "", 200);

    if (configEmp.usarAvisoEstoque !== false && estoqueRestanteCalculado <= 5) {
        window.mostrarAvisoEstoque(produtoObj.nome, estoqueRestanteCalculado);
    }

    if (vendaAtual.length === 0 && configEmp.usarFidelidade === true && !fidelidadePerguntada) {
        itemPendenteDeAdicao = { codigo: codigoEncontrado, quantidade: quantidade, produtoObj: produtoObj };
        document.getElementById('modal-pergunta-fidelidade').style.display = 'flex';
        return; 
    }

    adicionarAoCarrinhoComRegraFidelidade(codigoEncontrado, produtoObj.nome, produtoObj.valor, quantidade);
    atualizarTabela(); 
    
    document.getElementById("codigo-barra").value = "";
    document.getElementById("quantidade-produto").value = "1";
    if (document.getElementById("modalAvisoSistema").style.display !== 'flex') {
        document.getElementById("codigo-barra").focus();
    }
    document.getElementById('lista-sugestoes-caixa').style.display = 'none';
};

/* ==============================================================
   FIDELIDADE
   ============================================================== */
function processarItemPendenteFidelidade() {
    fidelidadePerguntada = true;
    if (itemPendenteDeAdicao) {
        var cod = itemPendenteDeAdicao.codigo;
        var qtd = itemPendenteDeAdicao.quantidade;
        var pObj = itemPendenteDeAdicao.produtoObj;
        adicionarAoCarrinhoComRegraFidelidade(cod, pObj.nome, pObj.valor, qtd);
        itemPendenteDeAdicao = null;
        atualizarTabela();
        document.getElementById("codigo-barra").value = "";
        document.getElementById("codigo-barra").focus();
    }
}
function ignorarFidelidade() { fecharModal('modal-pergunta-fidelidade'); fecharModal('modal-busca-fidelidade'); fecharModal('modal-cadastro-fidelidade'); processarItemPendenteFidelidade(); }
function abrirBuscaFidelidade() { fecharModal('modal-pergunta-fidelidade'); document.getElementById('modal-busca-fidelidade').style.display = 'flex'; document.getElementById('input-busca-fidelidade').value = ''; setTimeout(() => document.getElementById('input-busca-fidelidade').focus(), 100); }
function buscarClienteFidelidade() {
    let doc = document.getElementById('input-busca-fidelidade').value.trim();
    if (!doc) return window.mostrarAvisoModal("Digite o CPF/Telefone.");
    let clientes = window.obterDados("clientesFidelidade") || {};
    let clienteEncontrado = null; let docEncontrado = null;
    for (let key in clientes) { if (key === doc || clientes[key].telefone === doc) { clienteEncontrado = clientes[key]; docEncontrado = key; break; } }
    if (clienteEncontrado) { vincularClienteFidelidade(docEncontrado, clienteEncontrado); fecharModal('modal-busca-fidelidade'); processarItemPendenteFidelidade(); } else { window.mostrarAvisoModal("Cliente não encontrado!"); }
}
function abrirCadastroFidelidade() { fecharModal('modal-pergunta-fidelidade'); document.getElementById('modal-cadastro-fidelidade').style.display = 'flex'; document.getElementById('cad-fid-nome').value = ''; document.getElementById('cad-fid-doc').value = ''; document.getElementById('cad-fid-tel').value = ''; }

window.salvarNovoClienteFidelidade = function() {
    let nome = document.getElementById('cad-fid-nome').value.trim();
    let doc = document.getElementById('cad-fid-doc').value.replace(/\D/g, "");
    let tel = document.getElementById('cad-fid-tel').value.trim();
    
    if (!nome || !doc) return window.mostrarAvisoModal("Nome e CPF/CNPJ são obrigatórios!");
    if (doc.length !== 11 || !validarCPF(doc)) {
        return window.mostrarAvisoModal("CPF Inválido! Por favor, informe um CPF verdadeiro e completo.");
    }
    
    let clientesFid = window.obterDados("clientesFidelidade") || {};
    let clientesFiado = window.obterDados("clientesFiado") || {};

    if (clientesFid[doc]) return window.mostrarAvisoModal("Este CPF já está registado no Clube Fidelidade!");
    if (clientesFiado[doc]) return window.mostrarAvisoModal("Este CPF já existe no sistema na aba de Crediário!\n\nSe deseja incluir este cliente no Fidelidade, edite o cadastro dele pelo menu de 'Gestão de Clientes'.");
    
    clientesFid[doc] = { nome: nome, documento: doc, telefone: tel, compras: 0, dataCadastro: new Date().toISOString() };
    window.salvarDados("clientesFidelidade", clientesFid);
    vincularClienteFidelidade(doc, clientesFid[doc]);
    
    window.mostrarAvisoModal("Cliente registado no Fidelidade com sucesso!", "Sucesso");
    fecharModal('modal-cadastro-fidelidade');
    processarItemPendenteFidelidade();
};

function fecharModalPremio() { fecharModal('modal-alerta-premio'); document.getElementById("codigo-barra").focus(); }
function vincularClienteFidelidade(doc, dados) {
    clienteFidelidadeAtual = { documento: doc, dados: dados };
    let configEmp = window.obterDados("configEmpresa") || {};
    let meta = configEmp.fidelidadeMeta || 10;
    document.getElementById('status-cliente-fidelidade').style.display = 'block';
    document.getElementById('nome-cliente-fidelidade-vinculado').innerText = `${dados.nome} (${dados.compras} de ${meta} compras)`;
    if (document.getElementById('nome-cliente-venda')) document.getElementById('nome-cliente-venda').value = dados.nome;
    if (dados.compras >= meta) {
        let brinde = configEmp.fidelidadeBrinde || "Brinde";
        document.getElementById('texto-alerta-premio').innerText = `O cliente atingiu a meta de ${meta} compras!\nEle tem direito a: 1x ${brinde} grátis.\n\nO sistema dará o desconto automaticamente quando você passar o produto no caixa.`;
        document.getElementById('modal-alerta-premio').style.display = 'flex';
    }
}
function removerClienteFidelidade() {
    clienteFidelidadeAtual = null;
    document.getElementById('status-cliente-fidelidade').style.display = 'none';
    if (document.getElementById('nome-cliente-venda')) document.getElementById('nome-cliente-venda').value = '';
    if (brindeFidelidadeConcedido) {
        var prods = window.obterDados("produtos") || {};
        vendaAtual.forEach(item => { if (item.nome.startsWith("🎁 [BRINDE]")) { item.nome = item.nome.replace("🎁 [BRINDE] ", ""); if(prods[item.codigo]) { item.valor = prods[item.codigo].valor; } } });
        brindeFidelidadeConcedido = false; atualizarTabela();
    }
}

/* ==============================================================
   FLUXO DO CLIENTE FIADO NO CAIXA
============================================================== */
window.iniciarPagamentoFiado = function() {
    if (!window.isCaixaAberto()) return;
    if (vendaAtual.length === 0) return window.mostrarAvisoModal("Carrinho vazio!");
    if (clienteFiadoAtual) {
        finalizarVenda("Fiado", null, null);
    } else {
        aguardandoConfirmacaoFiado = true;
        fecharModal('modal-pagamento');
        document.getElementById('modal-busca-fiado').style.display = 'flex';
        let inputBusca = document.getElementById('input-busca-fiado');
        inputBusca.value = '';
        window.renderizarListaFiadosCaixa(""); 
        setTimeout(() => inputBusca.focus(), 100);
    }
};
window.fecharModalBuscaFiado = function() { fecharModal('modal-busca-fiado'); aguardandoConfirmacaoFiado = false; document.getElementById('codigo-barra').focus(); };
window.filtrarClientesFiadoCaixa = function() { window.renderizarListaFiadosCaixa(document.getElementById('input-busca-fiado').value.trim().toLowerCase()); };
window.renderizarListaFiadosCaixa = function(filtro) {
    let clientesF = window.obterDados("clientesFiado") || {};
    let container = document.getElementById("lista-clientes-fiado-caixa");
    container.innerHTML = "";
    let termoLimpo = (filtro || "").trim();
    if (!termoLimpo) { container.innerHTML = "<p style='padding: 20px; text-align: center; color: #64748b; margin: 0; font-size: 14px;'>Digite o CPF ou o nome do cliente...</p>"; return; }
    let chaves = Object.keys(clientesF);
    let contador = 0;
    chaves.forEach(doc => {
        let c = clientesF[doc];
        if (doc.toLowerCase().includes(termoLimpo) || c.nome.toLowerCase().includes(termoLimpo)) {
            contador++;
            let divida = parseFloat(c.saldoDevedor) || 0;
            let limite = parseFloat(c.limiteCredito) || 0;
            let disponivel = limite > 0 ? Math.max(0, limite - divida) : null;
            let dispFormatado = limite > 0 ? `R$ ${disponivel.toFixed(2)}` : "Ilimitado";
            let limiteFormatado = limite > 0 ? `R$ ${limite.toFixed(2)}` : "Ilimitado (Sem Teto)";
            let corDisponivel = (limite > 0 && disponivel <= 0) ? "#dc2626" : "#059669";
            container.innerHTML += `<div class='item-fiado-caixa' onclick="window.escolherClienteFiadoCaixa('${doc}')" style="padding: 14px; border-bottom: 1px solid #e2e8f0; cursor: pointer; background: white; transition: all 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='white'"><div style="font-weight: 700; color: #0f172a; font-size: 15px; display: flex; justify-content: space-between;"><span>👤 ${c.nome}</span><span style="font-size: 12px; color: #64748b; font-weight: 500; background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">CPF/Doc: ${doc}</span></div><div style="font-size: 13px; margin-top: 8px; display: flex; justify-content: space-between; background: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #f1f5f9;"><span style="color: #334155;">Limite Total: <b>${limiteFormatado}</b></span><span style="color: #334155;">Dívida Atual: <b style="color: #c0392b;">R$ ${divida.toFixed(2)}</b></span><span style="color: #334155;">Disponível: <b style="color: ${corDisponivel};">${dispFormatado}</b></span></div></div>`;
        }
    });
    if (contador === 0) container.innerHTML = "<p style='padding: 20px; text-align: center; color: #64748b; margin: 0; font-size: 14px;'>Nenhum cliente encontrado.</p>";
};
window.selecionarPrimeiroFiadoCaixa = function() {
    let clientesF = window.obterDados("clientesFiado") || {};
    let filtro = document.getElementById('input-busca-fiado').value.trim().toLowerCase();
    for (let key in clientesF) { if (!filtro || key.toLowerCase().includes(filtro) || clientesF[key].nome.toLowerCase().includes(filtro)) { window.escolherClienteFiadoCaixa(key); break; } }
};
window.escolherClienteFiadoCaixa = function(doc) {
    let clientesF = window.obterDados("clientesFiado") || {};
    if (clientesF[doc]) { vincularClienteFiado(doc, clientesF[doc]); fecharModal('modal-busca-fiado'); if (aguardandoConfirmacaoFiado) { aguardandoConfirmacaoFiado = false; finalizarVenda("Fiado", null, null); } }
};
function vincularClienteFiado(doc, dados) {
    clienteFiadoAtual = { documento: doc, dados: dados };
    document.getElementById('status-cliente-fiado').style.display = 'block';
    document.getElementById('nome-cliente-fiado-vinculado').innerText = `${dados.nome} (Dívida Atual: R$ ${parseFloat(dados.saldoDevedor || 0).toFixed(2)})`;
    if (document.getElementById('nome-cliente-venda')) document.getElementById('nome-cliente-venda').value = dados.nome;
}
window.removerClienteFiado = function() {
    clienteFiadoAtual = null; aguardandoConfirmacaoFiado = false;
    document.getElementById('status-cliente-fiado').style.display = 'none';
    if (document.getElementById('nome-cliente-venda')) document.getElementById('nome-cliente-venda').value = '';
};

function atualizarTabela() {
  var tbody = document.getElementById("itens-venda");
  if (!tbody) return;
  tbody.innerHTML = "";
  totalVenda = 0; 
  vendaAtual.forEach(function(item, index) {
    var subtotal = item.valor * item.quantidade;
    totalVenda += subtotal;
    var tr = document.createElement("tr");
    tr.innerHTML = "<td style='width: 30%;'>" + item.nome + "</td><td style='width: 20%;'>" + item.codigo + "</td><td style='width: 10%;'>" + item.quantidade + "</td><td style='width: 20%;'>R$ " + item.valor.toFixed(2) + "</td><td style='width: 20%;'>R$ " + subtotal.toFixed(2) + "</td>";
    tr.style.cursor = "pointer";
    tr.onclick = function() { window.solicitarSenha(index); };
    tbody.appendChild(tr);
  });
  atualizarResumoVenda(); 
}

window.abrirOpcoesPagamento = function() {
  if (!window.isCaixaAberto()) return window.mostrarAvisoModal("Caixa Fechado!");
  if (vendaAtual.length === 0) return window.mostrarAvisoModal("Nenhum item adicionado.");
  document.getElementById("modal-pagamento").style.display = "flex";
};
window.fecharModalPagamento = function() { fecharModal("modal-pagamento"); document.getElementById("codigo-barra").focus(); };

// ==============================================================
// LÓGICA DO QR CODE DO PIX NO CAIXA
// ==============================================================
window.iniciarPagamentoPix = function() {
    if (!window.isCaixaAberto()) return;
    let configEmp = window.obterDados("configEmpresa") || {};
    let qrCodeSalvo = localStorage.getItem("qrCodePix");

    if (configEmp.usarQrPix && qrCodeSalvo) {
        fecharModal('modal-pagamento');
        document.getElementById('valor-total-pix').innerText = totalVenda.toFixed(2);
        document.getElementById('img-qr-pix-caixa').src = qrCodeSalvo;
        document.getElementById('modal-pagamento-pix').style.display = 'flex';
    } else {
        fecharModal('modal-pagamento');
        finalizarVenda("Pix", null, null);
    }
};

window.fecharModalPix = function() {
    fecharModal('modal-pagamento-pix');
    document.getElementById('codigo-barra').focus();
};

window.confirmarPagamentoPix = function() {
    window.fecharModalPix();
    finalizarVenda("Pix", null, null);
};

// ==============================================================
// SANGRIA COM SENHA MASTER
// ==============================================================
window.abrirModalSangria = function() { 
    if (!window.isCaixaAberto()) return window.mostrarAvisoModal("Caixa Fechado!");
    document.getElementById("modal-sangria").style.display = "flex"; 
    document.getElementById("senha-sangria").value = "";
    document.getElementById("valor-sangria").value = "";
    document.getElementById("motivo-sangria").value = "";
    setTimeout(() => document.getElementById("senha-sangria").focus(), 100); 
};
window.fecharModalSangria = function() { fecharModal("modal-sangria"); };
window.confirmarSangria = function() {
    var senhaDigitada = document.getElementById("senha-sangria").value;
    var valor = parseFloat(document.getElementById("valor-sangria").value);
    var motivo = document.getElementById("motivo-sangria").value.trim();
    
    var senhasSys = window.obterDados("senhasSistema") || null;
    var senhaCorreta = senhasSys && senhasSys.master ? senhasSys.master : "1996"; 

    if (senhaDigitada !== senhaCorreta) {
        return window.mostrarAvisoModal("⚠️ Palavra-passe Master Incorreta!", "Acesso Negado");
    }

    if (isNaN(valor) || valor <= 0 || !motivo) {
        return window.mostrarAvisoModal("Preencha um valor válido e o motivo da sangria.");
    }

    var data = new Date();
    var offset = data.getTimezoneOffset() * 60000;
    var dataAtual = (new Date(data.getTime() - offset)).toISOString().split('T')[0];
    var usuario = sessionStorage.getItem("usuarioLogado") || "desconhecido";
    
    var movimentacoes = window.obterDados("movimentacoes") || {};
    if (!movimentacoes[dataAtual]) movimentacoes[dataAtual] = [];
    
    movimentacoes[dataAtual].push({ 
        tipoMovimento: 'sangria', 
        produto: 'SANGRIA: ' + motivo, 
        valor: valor, 
        quantidade: 1, 
        hora: data.toLocaleTimeString(), 
        formaPagamento: 'Dinheiro', 
        usuario: usuario, 
        data: dataAtual 
    });
    
    window.salvarDados("movimentacoes", movimentacoes);
    window.mostrarAvisoModal("Sangria registrada com sucesso!", "Sangria");
    window.fecharModalSangria();
};

window.abrirModalDesconto = function() {
    if (!window.isCaixaAberto()) return window.mostrarAvisoModal("Caixa Fechado!");
    if(vendaAtual.length === 0) return window.mostrarAvisoModal("Caixa vazio!");
    document.getElementById("modal-desconto").style.display = "flex";
    document.getElementById("senha-desconto").value = "";
    document.getElementById("valor-desconto").value = "";
    document.getElementById("desconto-valor-total-venda").innerText = totalVenda.toFixed(2);
    setTimeout(() => document.getElementById("senha-desconto").focus(), 100); 
};
window.fecharModalDesconto = function() { fecharModal("modal-desconto"); };
window.confirmarDesconto = function() {
    var senhaInput = document.getElementById("senha-desconto");
    var descInput = document.getElementById("valor-desconto");
    var senha = senhaInput.value;
    var desc = parseFloat(descInput.value);
    var senhasSys = window.obterDados("senhasSistema") || null;
    var senhaCorreta = senhasSys && senhasSys.master ? senhasSys.master : "1996"; 
    
    if (senha === senhaCorreta && !isNaN(desc) && desc > 0) {
        if(desc > totalVenda) return window.mostrarAvisoModal("O desconto não pode ser superior ao total da venda!");
        totalVenda = Math.max(0, totalVenda - desc);
        atualizarResumoVenda();
        senhaInput.value = ""; descInput.value = "";
        fecharModal("modal-desconto");
        window.mostrarAvisoModal("Desconto de R$ " + desc.toFixed(2) + " aplicado com sucesso!", "Desconto Aplicado");
    } else { 
        window.mostrarAvisoModal("Dados incorretos ou Palavra-passe Inválida!", "Erro de Segurança"); 
        senhaInput.value = ""; 
    }
};

// ==============================================================
// CONSULTA DE PREÇO (F7)
// ==============================================================
window.abrirModalConsultaPreco = function() {
    document.getElementById("modal-consulta-preco").style.display = "flex";
    var input = document.getElementById("input-consulta-preco");
    if(input) { input.value = ""; setTimeout(() => input.focus(), 100); }
    var res = document.getElementById("resultado-consulta-preco");
    if(res) res.innerHTML = "Aguardando produto...";
};

window.fecharModalConsultaPreco = function() {
    fecharModal("modal-consulta-preco");
    var cb = document.getElementById("codigo-barra");
    if (cb && window.isCaixaAberto()) cb.focus();
};

window.buscarPrecoModal = function() {
    var inputVal = document.getElementById("input-consulta-preco").value.trim();
    var res = document.getElementById("resultado-consulta-preco");
    if(!inputVal) {
        res.innerHTML = "<span style='color:#e74c3c;'>Digite um código ou nome!</span>";
        return;
    }
    
    var produtosNaNuvem = window.obterDados("produtos") || {};
    var configEmp = window.obterDados("configEmpresa") || {};
    var codigoEncontrado = null;

    if (produtosNaNuvem[inputVal]) {
        codigoEncontrado = inputVal;
    } else if (configEmp.usarBuscaNome === true) {
        var lowerInput = inputVal.toLowerCase();
        for (var key in produtosNaNuvem) {
            if (produtosNaNuvem[key].nome && produtosNaNuvem[key].nome.toLowerCase() === lowerInput) {
                codigoEncontrado = key;
                break;
            }
        }
    }

    if (!codigoEncontrado) {
        res.innerHTML = "<span style='color:#e74c3c;'>Produto não encontrado!</span>";
        document.getElementById("input-consulta-preco").value = "";
        document.getElementById("input-consulta-preco").focus();
        return;
    }

    var p = produtosNaNuvem[codigoEncontrado];
    res.innerHTML = `<div style="color:#2c3e50; font-size: 16px;">${p.nome}</div>
                     <div style="color:#27ae60; font-size: 26px; margin-top: 5px;">R$ ${parseFloat(p.valor).toFixed(2)}</div>
                     <div style="color:#7f8c8d; font-size: 12px; margin-top: 5px;">Estoque: ${p.quantidade || 0} un | Cód: ${codigoEncontrado}</div>`;
    
    document.getElementById("input-consulta-preco").value = "";
    document.getElementById("input-consulta-preco").focus();
};

// ==============================================================
// CONFERÊNCIA DE CAIXA (F6) - EXCLUSIVO SANGRIA E CHEQUE/VR SEPARADOS
// ==============================================================
window.abrirModalConferencia = function() {
    if (!window.isCaixaAberto()) return window.mostrarAvisoModal("O Caixa está fechado!");

    var dataAtualObj = new Date();
    var offset = dataAtualObj.getTimezoneOffset() * 60000;
    var dataFormatada = (new Date(dataAtualObj.getTime() - offset)).toISOString().split('T')[0];
    var operador = sessionStorage.getItem("usuarioLogado") || "Operador"; 

    var chaveValorAbertura = window.obterChaveCaixa("valor_abertura");
    var suprimentoDb = window.obterDados(chaveValorAbertura);
    var suprimentoLocal = localStorage.getItem(chaveValorAbertura);
    var suprimento = parseFloat(suprimentoDb || suprimentoLocal) || 0;

    var sangriasTotal = 0;
    var movimentacoes = window.obterDados("movimentacoes") || {};
    var movHoje = movimentacoes[dataFormatada] || [];

    movHoje.forEach(function(mov) { 
        // CONTABILIZA APENAS SANGRIAS REAIS NA CONFERÊNCIA DO CAIXA
        if (mov.tipoMovimento === 'sangria' && mov.usuario === operador) {
            sangriasTotal += (parseFloat(mov.valor) || 0); 
        }
    });

    var formasVenda = window.obterDados("resumoFormas") || { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Fiado: 0, Misto: 0 };

    var totalBrutoVendas = 0;
    Object.keys(formasVenda).forEach(function(k) { if(k !== 'Fiado') totalBrutoVendas += formasVenda[k]; });
    
    var dinheiroEsperadoGaveta = suprimento + (formasVenda.Dinheiro || 0) - sangriasTotal;

    document.getElementById("conf-abertura").innerText = "R$ " + suprimento.toFixed(2);
    document.getElementById("conf-dinheiro").innerText = "R$ " + (formasVenda.Dinheiro || 0).toFixed(2);
    document.getElementById("conf-pix").innerText = "R$ " + (formasVenda.Pix || 0).toFixed(2);
    document.getElementById("conf-credito").innerText = "R$ " + (formasVenda.Crédito || 0).toFixed(2);
    document.getElementById("conf-debito").innerText = "R$ " + (formasVenda.Débito || 0).toFixed(2);
    
    // CHEQUE E VR EM LINHAS DIFERENTES E CALCULADOS SEPARADAMENTE
    if(document.getElementById("conf-cheque")) document.getElementById("conf-cheque").innerText = "R$ " + (formasVenda.Cheque || 0).toFixed(2);
    if(document.getElementById("conf-vr")) document.getElementById("conf-vr").innerText = "R$ " + (formasVenda.VR || 0).toFixed(2);
    
    document.getElementById("conf-fiado").innerText = "R$ " + (formasVenda.Fiado || 0).toFixed(2);
    document.getElementById("conf-sangria").innerText = "- R$ " + sangriasTotal.toFixed(2);
    document.getElementById("conf-total-bruto").innerText = "R$ " + totalBrutoVendas.toFixed(2);
    document.getElementById("conf-gaveta").innerText = "R$ " + dinheiroEsperadoGaveta.toFixed(2);

    document.getElementById('modal-conferencia').style.display = 'flex';
};

window.fecharModalConferencia = function() {
    fecharModal('modal-conferencia');
    var cb = document.getElementById("codigo-barra");
    if(cb && window.isCaixaAberto()) cb.focus();
};

window.fecharModalMisto = function() { fecharModal("modal-pagamento-misto"); };
window.confirmarPagamentoMisto = function() {
    let pix = parseFloat(document.getElementById("pg-pix").value) || 0;
    let credito = parseFloat(document.getElementById("pg-credito").value) || 0;
    let debito = parseFloat(document.getElementById("pg-debito").value) || 0;
    let dinheiro = parseFloat(document.getElementById("pg-dinheiro").value) || 0;
    let cheque = parseFloat(document.getElementById("pg-cheque").value) || 0;
    let vr = parseFloat(document.getElementById("pg-vr").value) || 0;
    let fiadoMisto = parseFloat(document.getElementById("pg-fiado").value) || 0;

    let somaRecebida = pix + credito + debito + dinheiro + cheque + vr + fiadoMisto;
    if (Math.abs(somaRecebida - totalVenda) > 0.01) return window.mostrarAvisoModal("⚠️ A soma dos pagamentos deve ser exatamente igual ao total da venda!");

    if (fiadoMisto > 0 && !clienteFiadoAtual) {
        window.mostrarAvisoModal("⚠️ Selecionou um valor em Fiado, mas nenhum cliente fiado foi vinculado à venda!");
        aguardandoConfirmacaoFiado = true;
        fecharModal('modal-pagamento-misto');
        document.getElementById('modal-busca-fiado').style.display = 'flex';
        window.renderizarListaFiadosCaixa("");
        return;
    }

    if (fiadoMisto > 0 && clienteFiadoAtual) {
        let limite = parseFloat(clienteFiadoAtual.dados.limiteCredito) || 0;
        let dividaAtual = parseFloat(clienteFiadoAtual.dados.saldoDevedor) || 0;
        if (limite > 0 && (dividaAtual + fiadoMisto) > limite) return window.mostrarAvisoModal(`⚠️️ Crédito insuficiente para esta parte em Fiado!\nDisponível: R$ ${Math.max(0, limite - dividaAtual).toFixed(2)}`);
    }

    let pagamentosDetalhados = { "Pix": pix, "Crédito": credito, "Débito": debito, "Dinheiro": dinheiro, "Cheque": cheque, "VR": vr, "Fiado": fiadoMisto };
    fecharModal('modal-pagamento-misto');
    finalizarVenda("Misto", null, pagamentosDetalhados);
};

window.reimprimirUltimoCupom = function() {
    if (!window.isCaixaAberto()) return window.mostrarAvisoModal("Caixa Fechado!");
    var ultima = window.obterDados("ultimaVenda");
    if (!ultima) return window.mostrarAvisoModal("Nenhuma venda realizada nesta sessão.");
    window.imprimirCupom(ultima.itens, ultima.total, ultima.formaPagamento, ultima.valorRecebido !== undefined ? ultima.valorRecebido : null, ultima.pagamentosDetalhados !== undefined ? ultima.pagamentosDetalhados : null, ultima.idCupom, ultima.numeroPedido, ultima.nomeCliente, ultima.obsVenda);
};

// ==============================================================
// GERAÇÃO E IMPRESSÃO DO CUPOM (COM VALOR RECEBIDO E TROCO EM DINHEIRO)
// ==============================================================
window.imprimirCupom = function(itens, total, formaPagamento, valorRecebido, pagamentosDetalhados, idCupom, numeroPedido, nomeCliente, obsVenda) {
    if (window.salvarDados) {
        window.salvarDados("ultimaVenda", {
            itens: itens, total: total, formaPagamento: formaPagamento, 
            valorRecebido: valorRecebido, pagamentosDetalhados: pagamentosDetalhados, 
            idCupom: idCupom, numeroPedido: numeroPedido, nomeCliente: nomeCliente, obsVenda: obsVenda
        });
    }

    let config = window.obterDados ? window.obterDados('configEmpresa') : {};
    let nomeEmpresa = config.nomeCabecalho || "NOME DA LOJA";
    let tamanhoPapel = config.tamanhoImpressora === '80' ? '80mm' : '58mm';
    let operador = sessionStorage.getItem("usuarioLogado") || "admin";
    let agora = new Date();
    let dataAtual = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR');
    let numCupom = idCupom ? idCupom.replace(/\D/g, '').substring(0, 13) : Math.floor(Math.random() * 900000000000) + 100000000000;

    let linhaPedidoHtml = '';
    let exibePedido = (config.usarNumeroPedido === true || config.usarNumeroPedido === undefined || String(config.usarNumeroPedido) === "true");
    
    if (exibePedido && numeroPedido) {
        let numFmt = numeroPedido.toString().padStart(3, '0');
        linhaPedidoHtml = `
        <div class="line"></div>
        <div class="center" style="font-size: 22px; font-weight: 900; margin: 6px 0; border: 2px dashed #000; padding: 4px;">
            PEDIDO: ${numFmt}
        </div>`;
    }

    let clienteHtml = '';
    if (nomeCliente) {
        clienteHtml = `<div class="line"></div><div class="flex"><span>CLIENTE:</span><span>${nomeCliente.toUpperCase()}</span></div>`;
    }

    let subtotalBruto = 0;
    let itensHtml = '';
    itens.forEach(item => {
        let desc = item.nome.substring(0, 16); 
        let subtotalItem = item.valor * item.quantidade;
        subtotalBruto += subtotalItem;
        itensHtml += `<tr><td>${item.quantidade}</td><td>${desc}</td><td>${parseFloat(subtotalItem).toFixed(2)}</td></tr>`;
    });

    let descontoCalculado = subtotalBruto - parseFloat(total);
    let linhaDescontoHtml = '';
    if (descontoCalculado > 0.01) {
        linhaDescontoHtml = `
        <div class="line"></div>
        <div class="flex"><span>SUBTOTAL:</span><span>R$ ${subtotalBruto.toFixed(2)}</span></div>
        <div class="flex"><span>DESCONTO:</span><span>- R$ ${descontoCalculado.toFixed(2)}</span></div>`;
    }

    let trocoCupomHtml = '';
    if (formaPagamento && formaPagamento.toLowerCase() === 'dinheiro' && valorRecebido && valorRecebido > 0) {
        let calcTroco = Math.max(0, valorRecebido - parseFloat(total));
        trocoCupomHtml = `
        <div class="line"></div>
        <div class="flex"><span>VALOR RECEBIDO:</span><span>R$ ${parseFloat(valorRecebido).toFixed(2)}</span></div>
        <div class="flex"><span>TROCO:</span><span>R$ ${calcTroco.toFixed(2)}</span></div>`;
    }

    let htmlStr = `
    <html><head><style>
        @page { margin: 0; }
        body { font-family: 'Courier New', Courier, monospace; width: ${tamanhoPapel}; padding: 2mm; font-size: 12px; margin: 0; color: #000; font-weight: 900; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 4px 0; }
        .flex { display: flex; justify-content: space-between; }
        .items { width: 100%; border-collapse: collapse; margin: 4px 0; }
        .items th, .items td { text-align: right; font-weight: 900; font-size: 11px; padding: 2px 0; }
        .items th:nth-child(1), .items td:nth-child(1) { text-align: center; width: 15%; }
        .items th:nth-child(2), .items td:nth-child(2) { text-align: left; width: 55%; padding-left: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .items th:nth-child(3), .items td:nth-child(3) { width: 30%; }
        h2 { margin: 0; font-size: 16px; font-weight: 900; text-transform: uppercase;}
        p { margin: 2px 0; font-size: 11px; }
        .total-row { font-size: 15px; margin: 5px 0; align-items: center;}
    </style></head><body>
        <div class="center">
            <h2>${nomeEmpresa}</h2>
        </div>
        ${linhaPedidoHtml}
        <div class="line"></div>
        <div class="center">CUPOM NÃO FISCAL</div>
        <div class="line"></div>
        <div>Data: ${dataAtual}</div>
        <div class="flex"><span>Op: ${operador}</span><span>Cupom: ${numCupom}</span></div>
        ${clienteHtml}
        <div class="line"></div>
        <table class="items">
            <tr><th>QTD</th><th>DESC</th><th>TOT</th></tr>
            <tr><td colspan="3"><div class="line" style="margin: 2px 0;"></div></td></tr>
            ${itensHtml}
        </table>
        ${linhaDescontoHtml}
        <div class="line"></div>
        <div class="flex total-row"><span>TOTAL:</span><span>R$ ${parseFloat(total).toFixed(2)}</span></div>
        ${trocoCupomHtml}
        <div class="line"></div>
        <div class="flex"><span>PAGTO:</span><span>${formaPagamento.toUpperCase()}</span></div>
        <div class="line"></div>
        <div class="center" style="margin-top: 10px; font-size: 14px;">
            <p style="font-size: 14px;">Obrigado!</p>
            <p style="font-size: 14px;">Volte Sempre!</p>
        </div>
        <script>setTimeout(() => { window.print(); }, 800);<\/script>
    </body></html>`;

    let iframe = document.getElementById("iframe-impressao");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "iframe-impressao";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
    }
    let doc = iframe.contentWindow.document;
    doc.open(); doc.write(htmlStr); doc.close();
};

function finalizarVenda(formaPagamento, valorRecebido, pagamentosDetalhados) {
    if (formaPagamento === "Fiado") {
        if (!clienteFiadoAtual) { return window.iniciarPagamentoFiado(); }
        let limite = parseFloat(clienteFiadoAtual.dados.limiteCredito) || 0;
        let dividaAtual = parseFloat(clienteFiadoAtual.dados.saldoDevedor) || 0;
        if (limite > 0 && (dividaAtual + totalVenda) > limite) {
            let disponivel = Math.max(0, limite - dividaAtual);
            return window.mostrarAvisoModal(`❌ CRÉDITO RECUSADO!\n\n• Limite Total: R$ ${limite.toFixed(2)}\n• Dívida Atual: R$ ${dividaAtual.toFixed(2)}\n• Crédito Disponível: R$ ${disponivel.toFixed(2)}\n• Tentativa de Compra: R$ ${totalVenda.toFixed(2)}\n\nO valor da compra ultrapassa o limite liberado para este cliente.`, "Limite de Crédito Excedido");
        }
    }

    if (formaPagamento === "Misto" && pagamentosDetalhados && pagamentosDetalhados["Fiado"] > 0) {
        if (!clienteFiadoAtual) {
            window.mostrarAvisoModal("⚠️ Selecione um cliente fiado para a parte em crédito da loja.");
            return window.iniciarPagamentoFiado();
        }
        let limite = parseFloat(clienteFiadoAtual.dados.limiteCredito) || 0;
        let dividaAtual = parseFloat(clienteFiadoAtual.dados.saldoDevedor) || 0;
        let valorFiadoMisto = pagamentosDetalhados["Fiado"];
        if (limite > 0 && (dividaAtual + valorFiadoMisto) > limite) {
            let disponivel = Math.max(0, limite - dividaAtual);
            return window.mostrarAvisoModal(`❌ CRÉDITO RECUSADO PARA O MISTO!\n\n• Limite Total: R$ ${limite.toFixed(2)}\n• Dívida Atual: R$ ${dividaAtual.toFixed(2)}\n• Crédito Disponível: R$ ${disponivel.toFixed(2)}\n• Valor Fiado Solicitado: R$ ${valorFiadoMisto.toFixed(2)}\n\nO valor solicitado excede o limite disponível.`, "Limite de Crédito Excedido");
        }
    }

    var configEmp = window.obterDados("configEmpresa") || { usarModalCliente: true };
    if (configEmp.usarModalCliente && formaPagamento !== "Fiado") {
        vendaPendenteInfo = { formaPagamento, valorRecebido, pagamentosDetalhados };
        document.getElementById('modal-cliente-obs').style.display = 'flex';
        document.getElementById('obs-venda').value = '';
        document.getElementById('nome-cliente-venda').focus();
    } else {
        let nomeParaCupom = '';
        if (formaPagamento === "Fiado") nomeParaCupom = clienteFiadoAtual.dados.nome;
        else if (clienteFidelidadeAtual) nomeParaCupom = clienteFidelidadeAtual.dados.nome;
        else if (pagamentosDetalhados && pagamentosDetalhados["Fiado"] > 0 && clienteFiadoAtual) nomeParaCupom = clienteFiadoAtual.dados.nome;
        
        window.concluirVendaComDados(formaPagamento, valorRecebido, pagamentosDetalhados, nomeParaCupom, '');
    }
}

window.fecharModalClienteObs = function() { fecharModal('modal-cliente-obs'); };
window.confirmarDadosCliente = function() {
    var nomeCliente = document.getElementById('nome-cliente-venda').value.trim();
    var obsVenda = document.getElementById('obs-venda').value.trim();
    window.fecharModalClienteObs();
    window.concluirVendaComDados(vendaPendenteInfo.formaPagamento, vendaPendenteInfo.valorRecebido, vendaPendenteInfo.pagamentosDetalhados, nomeCliente, obsVenda);
};

window.concluirVendaComDados = function(formaPagamento, valorRecebido, pagamentosDetalhados, nomeCliente, obsVenda) {
  var data = new Date();
  var offset = data.getTimezoneOffset() * 60000;
  var dataAtual = (new Date(data.getTime() - offset)).toISOString().split('T')[0];
  var horaAtual = data.toLocaleTimeString();
  var usuario = sessionStorage.getItem("usuarioLogado") || "desconhecido";
  var configEmp = window.obterDados("configEmpresa") || {};
  
  var movimentacoes = window.obterDados("movimentacoes") || {};
  if (!movimentacoes[dataAtual]) movimentacoes[dataAtual] = [];
  var produtosFinais = window.obterDados("produtos") || {}; 

  let numPedido = parseInt(window.obterDados("numeroPedidoAtual"));
  if (isNaN(numPedido) || numPedido <= 0) numPedido = 1;
  let numPedidoFormatado = numPedido < 10 ? "0" + numPedido : String(numPedido);
  var idCupom = "CUPOM-" + Date.now() + "-" + Math.floor(Math.random() * 1000);

  vendaAtual.forEach(function(item) {
    if (produtosFinais[item.codigo]) { produtosFinais[item.codigo].quantidade -= item.quantidade; }
    movimentacoes[dataAtual].push({ 
        produto: item.nome, 
        codigo: item.codigo, 
        quantidade: item.quantidade, 
        valor: item.valor, 
        usuario: usuario, 
        hora: horaAtual, 
        formaPagamento: formaPagamento, 
        idCupom: idCupom, 
        tipoMovimento: 'venda', 
        data: dataAtual, 
        numeroPedido: numPedido, 
        cliente: nomeCliente, 
        observacao: obsVenda,
        valorRecebido: valorRecebido !== undefined ? valorRecebido : null 
    });
  });

  if (pagamentosDetalhados) {
    Object.keys(pagamentosDetalhados).forEach(function(f) { 
        if(resumoFormas[f] !== undefined) resumoFormas[f] += pagamentosDetalhados[f]; 
        else resumoFormas[f] = pagamentosDetalhados[f];
    });
  } else {
    if(resumoFormas[formaPagamento] !== undefined) resumoFormas[formaPagamento] += totalVenda;
  }
  
  if (configEmp.usarMonitorCozinha) {
      var pedidosCozinha = window.obterDados("pedidosCozinha") || {};
      pedidosCozinha[idCupom] = { idCupom: idCupom, numeroPedido: numPedidoFormatado, hora: horaAtual, cliente: nomeCliente || "Balcão", observacao: obsVenda || "", itens: vendaAtual.map(i => ({ nome: i.nome, quantidade: i.quantidade })), status: "pendente", timestamp: Date.now() };
      window.salvarDados("pedidosCozinha", pedidosCozinha);
  }

  if (clienteFidelidadeAtual && formaPagamento !== "Fiado") {
      let clientes = window.obterDados("clientesFidelidade") || {};
      let doc = clienteFidelidadeAtual.documento;
      if (clientes[doc]) {
          let meta = configEmp.fidelidadeMeta || 10;
          if (clientes[doc].compras >= meta) { clientes[doc].compras = 1; } else { clientes[doc].compras += 1; }
          window.salvarDados("clientesFidelidade", clientes);
      }
  }

  let valorFiadoAplicado = 0;
  if (formaPagamento === "Fiado") valorFiadoAplicado = totalVenda;
  else if (formaPagamento === "Misto" && pagamentosDetalhados && pagamentosDetalhados["Fiado"]) {
      valorFiadoAplicado = pagamentosDetalhados["Fiado"];
  }

  if (valorFiadoAplicado > 0 && clienteFiadoAtual) {
      let cFiado = window.obterDados("clientesFiado") || {};
      let docF = clienteFiadoAtual.documento;
      if (cFiado[docF]) {
          cFiado[docF].saldoDevedor = (parseFloat(cFiado[docF].saldoDevedor) || 0) + valorFiadoAplicado;
          window.salvarDados("clientesFiado", cFiado);
      }
  }

  window.salvarDados("produtos", produtosFinais);
  window.salvarDados("resumoFormas", resumoFormas);
  window.salvarDados("movimentacoes", movimentacoes);
  
  window.imprimirCupom(vendaAtual, totalVenda, formaPagamento, valorRecebido, pagamentosDetalhados, idCupom, numPedido, nomeCliente, obsVenda);
  window.salvarDados("numeroPedidoAtual", numPedido + 1);

  vendaAtual = [];
  atualizarTabela(); 
  fidelidadePerguntada = false;
  brindeFidelidadeConcedido = false;
  removerClienteFidelidade();
  window.removerClienteFiado();
  window.fecharModalPagamento();
};

window.solicitarSenha = function(index) {
  let tbody = document.getElementById("itens-venda");
  let linha = tbody.children[index];
  if (linha) linha.classList.toggle("selecionado-cancelar");
};

window.abrirModalSenhaCancelar = function() {
  if (!window.isCaixaAberto()) return window.mostrarAvisoModal("Caixa Fechado!");
  let inputSenha = document.getElementById("senha-cancelar-input");
  if(inputSenha) inputSenha.value = ""; 
  let selecionados = document.querySelectorAll("#itens-venda tr.selecionado-cancelar");
  if (selecionados.length === 0) return window.mostrarAvisoModal("Clique em cima dos produtos na lista para os selecionar (ficarão vermelhos) antes de clicar em Cancelar.", "Atenção");
  document.getElementById("modal-senha-cancelar").style.display = "flex";
  setTimeout(() => { if(inputSenha) inputSenha.focus(); }, 100);
};

window.fecharModalSenhaCancelar = function() {
  let inputSenha = document.getElementById("senha-cancelar-input");
  if(inputSenha) inputSenha.value = ""; 
  document.getElementById("modal-senha-cancelar").style.display = "none";
};

window.confirmarCancelamentoMultiplo = function() {
  var senhaDigitada = document.getElementById("senha-cancelar-input").value;
  var senhasSys = window.obterDados ? window.obterDados("senhasSistema") : null;
  var senhaCorreta = senhasSys && senhasSys.cancelarItem ? senhasSys.cancelarItem : "2201"; 

  if (senhaDigitada !== senhaCorreta) {
      window.mostrarAvisoModal("Palavra-passe de Cancelamento Incorreta!", "Acesso Negado");
      document.getElementById("senha-cancelar-input").value = ""; 
      return;
  }

  let tbody = document.getElementById("itens-venda");
  let indicesParaRemover = [];
  for (let i = 0; i < tbody.children.length; i++) {
      if (tbody.children[i].classList.contains("selecionado-cancelar")) indicesParaRemover.push(i);
  }

  indicesParaRemover.sort((a, b) => b - a).forEach(index => {
      let itemCancelado = vendaAtual.splice(index, 1)[0];
      if (itemCancelado && itemCancelado.nome.startsWith("🎁 [BRINDE]")) { brindeFidelidadeConcedido = false; }
  });

  atualizarTabela(); 
  window.fecharModalSenhaCancelar();
  document.getElementById("codigo-barra").focus();
};

document.addEventListener("keydown", function(event) {
  var modalBuscaFiado = document.getElementById("modal-busca-fiado");
  if (modalBuscaFiado && modalBuscaFiado.style.display === "flex") {
      if (event.code === "Escape") { event.preventDefault(); window.fecharModalBuscaFiado(); return; }
  }

  var modalPremio = document.getElementById("modal-alerta-premio");
  if (modalPremio && modalPremio.style.display === "flex") {
      if (event.key === "Enter") { event.preventDefault(); fecharModalPremio(); return; }
  }

  var modalAviso = document.getElementById("modalAvisoSistema");
  if (modalAviso && modalAviso.style.display === "flex") {
      if (modalAviso.dataset.bloqueado === "true") {
          event.preventDefault();
          event.stopPropagation();
          return;
      }
      if (event.key === "Enter" || event.code === "Escape") { 
          event.preventDefault(); 
          event.stopPropagation();
          window.fecharModalAvisoGlobal();
          return; 
      }
      return;
  }

  var modalPix = document.getElementById("modal-pagamento-pix");
  if (modalPix && modalPix.style.display === "flex") {
      if (event.key === "Enter") { event.preventDefault(); window.confirmarPagamentoPix(); return; }
      if (event.code === "Escape") { event.preventDefault(); window.fecharModalPix(); return; }
  }

  var modalPagamento = document.getElementById("modal-pagamento");
  if (modalPagamento && modalPagamento.style.display === "flex") {
    if (["Digit1","Numpad1","Digit2","Numpad2","Digit3","Numpad3","Digit4","Numpad4","Digit5","Numpad5","Digit6","Numpad6","Digit7","Numpad7","Digit8","Numpad8"].indexOf(event.code) !== -1) { event.preventDefault(); }
    switch (event.code) {
      case "Digit1": case "Numpad1": window.iniciarPagamentoPix(); break; 
      case "Digit2": case "Numpad2": finalizarVenda("Crédito", null, null); break;
      case "Digit3": case "Numpad3": finalizarVenda("Débito", null, null); break;
      case "Digit4": case "Numpad4": window.fecharModalPagamento(); document.getElementById("modal-troco").style.display = "flex"; document.getElementById("total-em-dinheiro").innerText = "R$ " + totalVenda.toFixed(2); document.getElementById("valor-recebido").value = ""; setTimeout(function() { document.getElementById("valor-recebido").focus(); }, 200); break; 
      case "Digit5": case "Numpad5": finalizarVenda("Cheque", null, null); break;
      case "Digit6": case "Numpad6": finalizarVenda("VR", null, null); break;
      case "Digit7": case "Numpad7": window.fecharModalPagamento(); document.getElementById('modal-pagamento-misto').style.display = 'flex'; document.getElementById("total-misto").innerText = "R$ " + totalVenda.toFixed(2); break;
      case "Digit8": case "Numpad8": 
          var configEmp = window.obterDados("configEmpresa") || {};
          let modSaaS = JSON.parse(localStorage.getItem('saas_modulos') || "{}");
          if (configEmp.usarFiado !== false && modSaaS.mod_fiado !== false) { window.iniciarPagamentoFiado(); } else { window.mostrarAvisoModal("A função de Contas Fiado está desativada nas configurações ou pelo seu plano.", "Acesso Negado"); }
          break;
    } return;
  }
  
  // BLOQUEIA ATALHOS SE O CAIXA ESTIVER FECHADO
  switch (event.code) {
      case "F2": event.preventDefault(); if (window.isCaixaAberto()) window.abrirOpcoesPagamento(); break;
      case "F3": event.preventDefault(); if (window.isCaixaAberto()) window.abrirModalDesconto(); break;
      case "F4": event.preventDefault(); if (window.isCaixaAberto()) window.abrirModalSangria(); break;
      case "F6": event.preventDefault(); if (window.isCaixaAberto()) window.abrirModalConferencia(); break;
      case "F7": event.preventDefault(); window.abrirModalConsultaPreco(); break;
      case "F8": event.preventDefault(); if (window.isCaixaAberto()) { window.abrirOpcoesPagamento(); setTimeout(() => { window.reimprimirUltimoCupom(); window.fecharModalPagamento(); }, 50); } break;
      case "F9": event.preventDefault(); if (window.isCaixaAberto()) window.fecharCaixa(); break;
      case "Escape": event.preventDefault(); window.location.href = 'sistema.html'; break;
  }
});

window.fecharModalTroco = function() { fecharModal("modal-troco"); };
var inputRecebido = document.getElementById("valor-recebido");
if (inputRecebido) { inputRecebido.addEventListener("input", function() { var rec = parseFloat(this.value) || 0; var troco = Math.max(0, rec - totalVenda); document.getElementById("valor-troco").innerText = "R$ " + troco.toFixed(2); }); }
window.confirmarTroco = function() {
    var rec = parseFloat(document.getElementById("valor-recebido").value) || 0;
    if (rec < totalVenda) return window.mostrarAvisoModal("Valor recebido é menor que o total!");
    window.fecharModalTroco(); finalizarVenda("Dinheiro", rec, null);
};

window.fecharCaixa = function() {
  if (!window.isCaixaAberto()) return window.mostrarAvisoModal("O caixa já se encontra fechado!");
  var modal = document.getElementById('modal-senha-fechamento');
  if (modal) { 
      modal.style.display = 'flex'; 
      var inputSenha = document.getElementById('input-senha-fechar'); 
      if (inputSenha) { inputSenha.value = ''; setTimeout(() => inputSenha.focus(), 100); } 
  } else { window.confirmarFechamentoCaixa(); }
};
window.fecharModalSenhaFechamento = function() { fecharModal('modal-senha-fechamento'); };

window.confirmarFechamentoCaixa = function() {
  var senha = document.getElementById('input-senha-fechar').value;
  var senhasSys = window.obterDados("senhasSistema") || { fecharCaixa: "2201" };
  if (senha !== senhasSys.fecharCaixa) return window.mostrarAvisoModal("Senha incorreta!");
  
  if (!window.isCaixaAberto()) {
      window.fecharModalSenhaFechamento();
      return window.mostrarAvisoModal("O caixa já se encontra fechado!");
  }

  var dataAtualObj = new Date();
  var offset = dataAtualObj.getTimezoneOffset() * 60000;
  var dataFormatada = (new Date(dataAtualObj.getTime() - offset)).toISOString().split('T')[0];
  var horaFechamento = dataAtualObj.toLocaleTimeString();
  var operador = sessionStorage.getItem("usuarioLogado") || "Operador"; 
  
  var chaveStatusCaixa = window.obterChaveCaixa("aberto_status");
  var chaveValorAbertura = window.obterChaveCaixa("valor_abertura");

  var suprimentoDb = window.obterDados(chaveValorAbertura);
  var suprimentoLocal = localStorage.getItem(chaveValorAbertura);
  var suprimento = parseFloat(suprimentoDb || suprimentoLocal) || 0;
  
  var sangriasTotal = 0;
  var movimentacoes = window.obterDados("movimentacoes") || {};
  var movHoje = movimentacoes[dataFormatada] || [];
  
  movHoje.forEach(function(mov) { 
      if (mov.tipoMovimento === 'sangria' && mov.usuario === operador) {
          sangriasTotal += (parseFloat(mov.valor) || 0); 
      }
  });
  
  var formasVenda = window.obterDados("resumoFormas") || { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Fiado: 0, Misto: 0 };
  
  var totalBrutoVendas = 0;
  Object.keys(formasVenda).forEach(function(k) { if(k !== 'Fiado') totalBrutoVendas += formasVenda[k]; });
  var valorLiquido = totalBrutoVendas - sangriasTotal;
  var dinheiroEsperadoGaveta = suprimento + (formasVenda.Dinheiro || 0) - sangriasTotal;
  var fiadoDia = formasVenda.Fiado || 0;
  
  var configLoja = window.obterDados("configLoja") || { nome: "NOME DA EMPRESA", cnpj: "00.000.000/0000-00" };
  var configEmp = window.obterDados("configEmpresa") || {};
  var nomeExibirFechamento = configEmp.nomeCabecalho || configLoja.nome || "NOME DA EMPRESA";
  var impressora = configEmp.tamanhoImpressora || "58";
  var cssPageSize = impressora === "80" ? "80mm auto" : "48mm auto";
  var cssBodyWidth = impressora === "80" ? "74mm" : "44mm";
  var cssFontSize = impressora === "80" ? "12px" : "9.5px";
  var cssTitleSize = impressora === "80" ? "14px" : "11px";

  var htmlFechamento = "<!DOCTYPE html><html><head><style>* { box-sizing: border-box; } @page { size: " + cssPageSize + "; margin: 0; } body { font-family: 'Courier New', Courier, monospace; font-weight: 900; font-size: " + cssFontSize + "; width: " + cssBodyWidth + "; margin: 0 auto; padding: 4px 0; color: #000; -webkit-print-color-adjust: exact; } h2, h3 { margin: 2px 0; text-align: center; font-size: " + cssTitleSize + "; font-weight: 900; text-transform: uppercase; } p { margin: 1px 0; text-align: center; font-size: " + cssFontSize + "; font-weight: 900; } .divider { border-top: 1px dashed #000; margin: 3px 0; } .right { text-align: right; } .bold { font-weight: 900; } .info-line { display: flex; justify-content: space-between; font-size: " + cssFontSize + "; font-weight: 900; margin: 1px 0; }</style></head><body><h2>" + nomeExibirFechamento + "</h2><p>CNPJ: " + configLoja.cnpj + "</p><div class='divider'></div><h3>FECHAMENTO DE CAIXA</h3><div class='divider'></div><div class='info-line'><span>Data:</span><span>" + dataAtualObj.toLocaleDateString('pt-BR') + "</span></div><div class='info-line'><span>Hora Fech:</span><span>" + horaFechamento + "</span></div><div class='info-line'><span>Operador:</span><span>" + operador + "</span></div><div class='divider'></div><h3>VENDAS POR TIPO</h3>";
  
  Object.keys(formasVenda).forEach(function(k) { 
      if (formasVenda[k] > 0 && k !== 'Fiado') {
          htmlFechamento += "<div class='info-line'><span>" + k + ":</span><span>R$ " + formasVenda[k].toFixed(2) + "</span></div>"; 
      }
  });
  if(fiadoDia > 0) htmlFechamento += "<div class='divider'></div><div class='info-line bold'><span>FIADO (A Receber):</span><span>R$ " + fiadoDia.toFixed(2) + "</span></div>";

  htmlFechamento += "<div class='divider'></div><h3>RESUMO FINANCEIRO</h3><div class='info-line'><span>Suprimento:</span><span>R$ " + suprimento.toFixed(2) + "</span></div><div class='info-line'><span>Sangrias:</span><span>R$ " + sangriasTotal.toFixed(2) + "</span></div><div class='info-line bold'><span>Total Bruto Recebido:</span><span>R$ " + totalBrutoVendas.toFixed(2) + "</span></div><div class='divider'></div><div class='info-line bold' style='font-size:" + cssTitleSize + ";'><span>VALOR LÍQUIDO:</span><span>R$ " + valorLiquido.toFixed(2) + "</span></div><div class='divider'></div><div class='info-line bold'><span>GAVETA (Dinheiro):</span><span>R$ " + dinheiroEsperadoGaveta.toFixed(2) + "</span></div><p style='font-size: 8.5px;'>(Abertura + Dinheiro - Sangrias)</p><div class='divider'></div><p style='margin-top:6px; font-weight: 900;'>*** FIM DO RESUMO ***</p></body></html>";

  // 1. SINCRONIZA O FECHO COM O FIREBASE DEFINITIVAMENTE
  window.salvarDados(chaveStatusCaixa, "FECHADO");
  window.salvarDados(chaveValorAbertura, "0");
  
  localStorage.removeItem(chaveStatusCaixa);
  localStorage.setItem(chaveStatusCaixa, "FECHADO"); 
  localStorage.removeItem(chaveValorAbertura);
  
  window.salvarDados("statusCaixaAberto", false);
  window.salvarDados("caixa_aberto_status", "FECHADO");
  window.salvarDados("caixa_valor_abertura", "0");
  
  window.salvarDados("resumoFormas", { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Fiado: 0, Misto: 0 }); 
  window.salvarDados("numeroPedidoAtual", 1);
  
  // 2. ATUALIZA A TELA IMEDIATAMENTE E BLOQUEIA INTERAÇÕES
  atualizarTopBar();
  window.fecharModalSenhaFechamento();
  window.mostrarAvisoModal("Imprimindo Resumo e Finalizando Sessão...");

  // 3. IMPRIME E REDIRECIONA
  try {
      var iframe = document.getElementById("iframe-impressao");
      if (!iframe) {
          iframe = document.createElement("iframe");
          iframe.id = "iframe-impressao";
          iframe.style.display = "none";
          document.body.appendChild(iframe);
      }
      var doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open(); 
      doc.write(htmlFechamento); 
      doc.close();

      setTimeout(function() { 
          try {
              iframe.contentWindow.focus(); 
              iframe.contentWindow.print(); 
          } catch(e) { console.error("Erro no print:", e); }
          setTimeout(function() { 
              window.location.replace("sistema.html"); 
          }, 1500); 
      }, 500);
  } catch(e) {
      console.error("Falha ao criar layout de impressão:", e);
      setTimeout(function() { window.location.replace("sistema.html"); }, 1000);
  }
};

window.abrirModalAbertura = function() { 
    var modal = document.getElementById('modal-abertura');
    if (modal) {
        modal.style.zIndex = '99999999';
        modal.style.display = 'flex'; 
        setTimeout(() => document.getElementById("valor-abertura").focus(), 100);
    }
};

window.confirmarAbertura = function() {
  var valor = parseFloat(document.getElementById('valor-abertura').value);
  if (isNaN(valor) || valor < 0) return window.mostrarAvisoModal("Valor inválido");
  
  var chaveSt = window.obterChaveCaixa("aberto_status");
  var chaveVal = window.obterChaveCaixa("valor_abertura");
  
  window.salvarDados(chaveSt, "ABERTO");
  window.salvarDados(chaveVal, valor.toFixed(2));
  
  localStorage.setItem(chaveSt, "ABERTO");
  localStorage.setItem(chaveVal, valor.toFixed(2));
  
  let numAtual = parseInt(window.obterDados("numeroPedidoAtual"));
  if (isNaN(numAtual) || numAtual <= 0) window.salvarDados("numeroPedidoAtual", 1);
  
  fecharModal('modal-abertura');
  atualizarTopBar();
  inicializarCaixaCompleto();
  
  vendaAtual = [];
  atualizarTabela();
};

window.abrirModalEstoque = function() {
  var tabelaCorpo = document.getElementById("lista-estoque-corpo");
  if (!tabelaCorpo) return;
  tabelaCorpo.innerHTML = "";
  var produtos = window.obterDados("produtos") || {};
  var codigos = Object.keys(produtos);
  if (codigos.length === 0) { tabelaCorpo.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Nenhum produto em estoque.</td></tr>"; } 
  else { codigos.forEach(function(cod) { var prod = produtos[cod]; var tr = document.createElement("tr"); tr.innerHTML = "<td>" + cod + "</td><td>" + prod.nome + "</td><td>R$ " + parseFloat(prod.valor).toFixed(2) + "</td><td>" + prod.quantidade + "</td>"; tabelaCorpo.appendChild(tr); }); }
  document.getElementById("modal-estoque").style.display = "flex";
};
window.fecharModalEstoque = function() { fecharModal("modal-estoque"); document.getElementById("codigo-barra").focus(); };

window.handleInputCaixaKeyDown = function(event) {
  var modalAviso = document.getElementById("modalAvisoSistema");
  if (modalAviso && modalAviso.style.display === "flex") {
      return; 
  }

  let lista = document.getElementById('lista-sugestoes-caixa');
  let itens = lista ? lista.getElementsByClassName('suggestion-item-caixa') : [];

  if (lista && lista.style.display === 'block' && itens.length > 0) {
      if (event.key === 'ArrowDown') {
          event.preventDefault(); indexSugestaoAtual++;
          if (indexSugestaoAtual >= itens.length) indexSugestaoAtual = 0; destacarSugestaoCaixa(itens);
      } else if (event.key === 'ArrowUp') {
          event.preventDefault(); indexSugestaoAtual--;
          if (indexSugestaoAtual < 0) indexSugestaoAtual = itens.length - 1; destacarSugestaoCaixa(itens);
      } else if (event.key === 'Enter') {
          event.preventDefault();
          event.stopPropagation();
          if (indexSugestaoAtual >= 0 && indexSugestaoAtual < itens.length) { itens[indexSugestaoAtual].click(); } else { itens[0].click(); }
      }
  } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.adicionarItemVenda === "function") window.adicionarItemVenda();
  }
};

function destacarSugestaoCaixa(itens) {
  for (let i = 0; i < itens.length; i++) { itens[i].classList.remove('ativo'); }
  if (indexSugestaoAtual >= 0 && indexSugestaoAtual < itens.length) {
      let itemAtivo = itens[indexSugestaoAtual];
      itemAtivo.classList.add('ativo');
      itemAtivo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

window.handleInputCaixaSearch = function(termo) {
  indexSugestaoAtual = -1;
  let container = document.getElementById('lista-sugestoes-caixa');
  let config = window.obterDados ? window.obterDados("configEmpresa") || {} : {};
  
  if (config.usarBuscaNome !== true) { container.style.display = 'none'; container.innerHTML = ''; return; }
  termo = termo.trim().toLowerCase();
  if (!termo || termo.length < 2 || /^\d+$/.test(termo)) { container.style.display = 'none'; container.innerHTML = ''; return; }

  let produtos = window.obterDados ? window.obterDados("produtos") || {} : {};
  let encontrados = [];
  Object.keys(produtos).forEach(codigo => {
      let p = produtos[codigo];
      if (p && p.nome && p.nome.toLowerCase().includes(termo)) encontrados.push({ codigo: codigo, p: p });
  });

  if (encontrados.length === 0) { container.style.display = 'none'; container.innerHTML = ''; return; }

  container.innerHTML = '';
  encontrados.forEach(item => {
      let div = document.createElement('div');
      div.className = 'suggestion-item-caixa';
      div.innerHTML = `<div style="display:flex; flex-direction:column; text-align:left;"><strong style="color:#0f172a; font-size:14px;">${item.p.nome}</strong><span style="color:#64748b; font-size:11px;">Cód: ${item.codigo} | Estoque: ${item.p.quantidade || 0} un</span></div><strong style="color:#059669; font-size:14px;">R$ ${(parseFloat(item.p.valor) || 0).toFixed(2)}</strong>`;
      div.onclick = function() { 
          document.getElementById("codigo-barra").value = item.codigo; container.style.display = 'none';
          setTimeout(() => { if(typeof window.adicionarItemVenda === "function") window.adicionarItemVenda(); }, 50);
      };
      container.appendChild(div);
  });
  container.style.display = 'block';
};

// ==========================================
// 1. FUNÇÃO DE IMPRESSÃO DO COMPROVANTE DE SANGRIA
// ==========================================
window.imprimirComprovanteSangria = function(operador, valor, motivo, dataHora) {
    let config = window.obterDados ? window.obterDados('configEmpresa') : {};
    let nomeEmpresa = config.nomeCabecalho || "NOME DA LOJA";
    let tamanhoPapel = config.tamanhoImpressora === '80' ? '80mm' : '58mm';

    let htmlStr = `
    <html><head><style>
        @page { margin: 0; }
        body { font-family: 'Courier New', Courier, monospace; width: ${tamanhoPapel}; padding: 2mm; font-size: 12px; margin: 0; color: #000; font-weight: 900; }
        .center { text-align: center; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .flex { display: flex; justify-content: space-between; }
        h3 { margin: 0 0 5px 0; font-size: 15px; text-transform: uppercase; }
        p { margin: 3px 0; font-size: 11px; }
    </style></head><body>
        <div class="center">
            <h3>${nomeEmpresa}</h3>
            <p>COMPROVANTE DE SANGRIA</p>
        </div>
        <div class="line"></div>
        <div>Data/Hora: ${dataHora}</div>
        <div>Operador: ${operador}</div>
        <div class="line"></div>
        <p style="font-size: 13px;">MOTIVO:</p>
        <p style="font-size: 14px; font-weight: bold;">${motivo.toUpperCase()}</p>
        <div class="line"></div>
        <div class="flex" style="font-size: 15px;"><span>VALOR RETIRADO:</span><span>R$ ${valor.toFixed(2)}</span></div>
        <div class="line"></div>
        <div class="center" style="margin-top: 25px;">
            <p>___________________________________</p>
            <p>Assinatura do Operador</p>
        </div>
        <script>setTimeout(() => { window.print(); }, 800);<\/script>
    </body></html>`;

    let iframe = document.getElementById("iframe-impressao");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "iframe-impressao";
        iframe.style.display = "none";
        document.body.appendChild(iframe);
    }
    let doc = iframe.contentWindow.document;
    doc.open(); doc.write(htmlStr); doc.close();
};

// ==========================================
// 2. FUNÇÃO DE CONFIRMAÇÃO DA SANGRIA
// ==========================================
window.abrirModalSangria = function() { 
    if (!window.isCaixaAberto()) return window.mostrarAvisoModal("Caixa Fechado!");
    document.getElementById("modal-sangria").style.display = "flex"; 
    document.getElementById("senha-sangria").value = "";
    document.getElementById("valor-sangria").value = "";
    document.getElementById("motivo-sangria").value = "";
    setTimeout(() => document.getElementById("senha-sangria").focus(), 100); 
};

window.fecharModalSangria = function() { fecharModal("modal-sangria"); };

window.confirmarSangria = function() {
    var senhaDigitada = document.getElementById("senha-sangria").value;
    var valor = parseFloat(document.getElementById("valor-sangria").value);
    var motivo = document.getElementById("motivo-sangria").value.trim();
    
    var senhasSys = window.obterDados("senhasSistema") || null;
    var senhaCorreta = senhasSys && senhasSys.master ? senhasSys.master : "1996"; 

    if (senhaDigitada !== senhaCorreta) {
        return window.mostrarAvisoModal("⚠️ Palavra-passe Master Incorreta!", "Acesso Negado");
    }

    if (isNaN(valor) || valor <= 0 || !motivo) {
        return window.mostrarAvisoModal("Preencha um valor válido e o motivo da sangria.");
    }

    var data = new Date();
    var offset = data.getTimezoneOffset() * 60000;
    var dataAtual = (new Date(data.getTime() - offset)).toISOString().split('T')[0];
    var horaAtual = data.toLocaleTimeString();
    var operador = sessionStorage.getItem("usuarioLogado") || "desconhecido";
    
    var movimentacoes = window.obterDados("movimentacoes") || {};
    if (!movimentacoes[dataAtual]) movimentacoes[dataAtual] = [];
    
    movimentacoes[dataAtual].push({ 
        tipoMovimento: 'sangria', 
        produto: 'SANGRIA: ' + motivo, 
        valor: valor, 
        quantidade: 1, 
        hora: horaAtual, 
        formaPagamento: 'Dinheiro', 
        usuario: operador, 
        data: dataAtual 
    });
    
    window.salvarDados("movimentacoes", movimentacoes);
    
    // Dispara a impressão do comprovante corretamente
    window.imprimirComprovanteSangria(operador, valor, motivo, data.toLocaleDateString('pt-BR') + ' ' + horaAtual);
    
    window.mostrarAvisoModal("Sangria registrada e comprovante impresso com sucesso!", "Sangria Realizada");
    window.fecharModalSangria();
};
