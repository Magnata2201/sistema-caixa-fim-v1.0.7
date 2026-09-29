// ==========================================
// FUNÇÕES DE SINCRONIZAÇÃO NATIVA
// ==========================================
window.obterDados = window.obterDados || function(chave) {
    const dados = localStorage.getItem(chave);
    try { return dados ? JSON.parse(dados) : null; } catch(e) { return null; }
};
window.salvarDados = window.salvarDados || function(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
};
const obterDados = window.obterDados;
const salvarDados = window.salvarDados;

let produtos = {};
let produtoEmEdicao = null; 
let dadosImportacaoPendente = null;

function fecharModal(idModal) { 
    const modal = document.getElementById(idModal);
    if(modal) modal.style.display = 'none'; 
}

// ------------------------------------------------------------------
// SISTEMA GLOBAL DE ALERTAS EM MODAL (EVITA 100% OS ALERT NATIVOS DO BROWSER)
// ------------------------------------------------------------------
window.mostrarAlertaGlobal = function(msg, titulo = "Aviso") {
    let modalCaixa = document.getElementById("modalAvisoSistema");
    let tituloCaixa = document.getElementById("tituloAvisoModal");
    let msgCaixa = document.getElementById("mensagemAvisoModal");
    
    if (modalCaixa && tituloCaixa && msgCaixa) {
        tituloCaixa.innerText = titulo;
        msgCaixa.innerText = msg;
        modalCaixa.style.display = "flex";
        let btn = modalCaixa.querySelector('button');
        if(btn) setTimeout(() => btn.focus(), 100);
        return;
    }

    let modalSys = document.getElementById("modalAlertaCustom");
    let tituloSys = document.getElementById("tituloAlertaCustom");
    let msgSys = document.getElementById("mensagemAlertaCustom");

    if (modalSys && tituloSys && msgSys) {
        tituloSys.innerText = titulo;
        msgSys.innerText = msg;
        modalSys.style.display = "flex";
        let btn = modalSys.querySelector('button');
        if(btn) setTimeout(() => btn.focus(), 100);
        return;
    }

    let modalFallback = document.getElementById('modal-alerta-global-fallback');
    if (!modalFallback) {
        modalFallback = document.createElement('div');
        modalFallback.id = 'modal-alerta-global-fallback';
        modalFallback.style.cssText = "display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); align-items: center; justify-content: center; z-index: 2147483647;";
        modalFallback.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 12px; width: 90%; max-width: 420px; text-align: center; box-shadow: 0 15px 40px rgba(0,0,0,0.5);">
                <h2 id="titulo-alerta-global" style="margin-top: 0; color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; font-size: 20px;"></h2>
                <p id="msg-alerta-global" style="font-size: 15px; color: #333; margin: 20px 0; font-weight: bold; white-space: pre-wrap; text-align: left; line-height: 1.5;"></p>
                <button onclick="document.getElementById('modal-alerta-global-fallback').style.display='none'" style="width: 100%; padding: 12px; background: #3498db; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 15px;">OK</button>
            </div>
        `;
        document.body.appendChild(modalFallback);
    }
    document.getElementById('titulo-alerta-global').innerText = titulo;
    document.getElementById('msg-alerta-global').innerText = msg;
    modalFallback.style.display = 'flex';
    setTimeout(() => { modalFallback.querySelector('button').focus(); }, 100);
};

function showMessage(msg, isError = false) {
    window.mostrarAlertaGlobal(msg, isError ? "⚠️ Erro / Aviso" : "✅ Informação");
}

function updateLowStockList() {
  const lowStockList = document.getElementById("low-stock-list");
  if (!lowStockList) return;
  lowStockList.innerHTML = "";
  const lowStockProducts = Object.values(produtos).filter(p => p.quantidade <= 5 && p.quantidade > 0);

  if (lowStockProducts.length === 0) {
    lowStockList.innerHTML = "<p>Nenhum produto com stock baixo.</p>";
    return;
  }
  lowStockProducts.forEach(p => {
    const pElement = document.createElement("p");
    pElement.textContent = `${p.nome}: ${p.quantidade} unidades restantes`;
    lowStockList.appendChild(pElement);
  });
}

function abrirModalVerificarQuantidade() {
    const modal = document.getElementById('modalEditarProduto');
    if (!modal) return;
    
    modal.style.display = 'flex';
    const inputCodigo = document.getElementById('editProdutoCodigo');
    
    if (inputCodigo) {
        inputCodigo.value = '';
        inputCodigo.removeAttribute('readonly'); 
        inputCodigo.focus();
        
        inputCodigo.onkeypress = function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const barcode = this.value.trim();
                if (produtos[barcode]) {
                    const produto = produtos[barcode];
                    if(document.getElementById('editProdutoNome')) document.getElementById('editProdutoNome').value = produto.nome;
                    if(document.getElementById('editProdutoQuantidade')) document.getElementById('editProdutoQuantidade').value = produto.quantidade;
                    if(document.getElementById('editProdutoPreco')) document.getElementById('editProdutoPreco').value = produto.valor;
                    produtoEmEdicao = barcode; 
                    this.setAttribute('readonly', 'true');
                } else {
                    showMessage("Produto não encontrado.", true);
                    this.value = '';
                    produtoEmEdicao = null;
                }
            }
        };
    }
    
    if (document.getElementById('editProdutoNome')) document.getElementById('editProdutoNome').value = '';
    if (document.getElementById('editProdutoQuantidade')) document.getElementById('editProdutoQuantidade').value = '';
    if (document.getElementById('editProdutoPreco')) document.getElementById('editProdutoPreco').value = '';
}

function fecharModalEditarProduto() { fecharModal('modalEditarProduto'); }

function abrirModalRegistrarProduto() {
    const modal = document.getElementById('modalRegistrarProduto');
    if (!modal) return;
    
    modal.style.display = 'flex';
    if(document.getElementById('newBarcodeModal')) document.getElementById('newBarcodeModal').value = '';
    if(document.getElementById('newNameModal')) document.getElementById('newNameModal').value = '';
    if(document.getElementById('newStockModal')) document.getElementById('newStockModal').value = '1';
    if(document.getElementById('newPriceModal')) document.getElementById('newPriceModal').value = '';
}

function fecharModalRegistrarProduto() { fecharModal('modalRegistrarProduto'); }

function registerProductModal() {
  const barcodeEl = document.getElementById("newBarcodeModal");
  const nameEl = document.getElementById("newNameModal");
  const stockEl = document.getElementById("newStockModal");
  const priceEl = document.getElementById("newPriceModal");
  
  if (!barcodeEl || !nameEl || !stockEl || !priceEl) return;

  const newBarcode = barcodeEl.value.trim();
  const newName = nameEl.value.trim();
  const newStock = parseInt(stockEl.value.trim());
  const newPrice = parseFloat(priceEl.value.trim());

  if (!newBarcode || !newName || isNaN(newStock) || newStock <= 0 || isNaN(newPrice) || newPrice <= 0) return showMessage("Dados inválidos.", true);
  if (produtos[newBarcode]) return showMessage("Código de barras já existe.", true);
  
  produtos[newBarcode] = { nome: newName, quantidade: newStock, valor: newPrice };
  salvarDados("produtos", produtos);
  showMessage("Produto registado!");
  fecharModalRegistrarProduto();
  updateLowStockList();
}

function solicitarSenha() {
  const modal = document.getElementById("senhaModal");
  const input = document.getElementById("senhaInput");
  
  if (produtoEmEdicao && modal && input) {
    modal.style.display = "flex";
    input.value = "";
    setTimeout(() => input.focus(), 100);
  } else if (!produtoEmEdicao) {
    showMessage("Carregue um produto no modal para editar.", true);
  }
}

function verificarSenha(event) {
  if (event.key === "Enter") {
    const input = document.getElementById("senhaInput");
    if (!input) return;
    
    const senha = input.value;
    const senhasSys = obterDados("senhasSistema") || { master: "1996" };
    
    if (senha === senhasSys.master) { 
      fecharModal("senhaModal");
      const codEl = document.getElementById('editProdutoCodigo');
      const nomeEl = document.getElementById('editProdutoNome');
      const qtdEl = document.getElementById('editProdutoQuantidade');
      const precoEl = document.getElementById('editProdutoPreco');
      
      if(codEl) codEl.removeAttribute('readonly'); 
      if(nomeEl) { nomeEl.removeAttribute('readonly'); nomeEl.focus(); }
      if(qtdEl) qtdEl.removeAttribute('readonly');
      if(precoEl) precoEl.removeAttribute('readonly');
    } else {
      showMessage("Palavra-passe incorreta!", true);
      input.value = "";
    }
  }
}

function salvarEdicaoProduto() {
    const codEl = document.getElementById('editProdutoCodigo');
    const nomeEl = document.getElementById('editProdutoNome');
    const qtdEl = document.getElementById('editProdutoQuantidade');
    const precoEl = document.getElementById('editProdutoPreco');
    
    if(!codEl || !nomeEl || !qtdEl || !precoEl) return;

    const codigo = codEl.value.trim();
    const nome = nomeEl.value.trim();
    const quantidade = parseInt(qtdEl.value);
    const preco = parseFloat(precoEl.value);

    if (!codigo || !nome || isNaN(quantidade) || quantidade < 0 || isNaN(preco) || preco <= 0) return showMessage("Campos inválidos.", true);
    if (codigo !== produtoEmEdicao && produtos[codigo]) return showMessage(`O código já está em uso.`, true);
    
    if (produtoEmEdicao && codigo !== produtoEmEdicao) delete produtos[produtoEmEdicao];
    produtos[codigo] = { nome: nome, quantidade: quantidade, valor: preco };
    salvarDados("produtos", produtos);
    showMessage(`Produto atualizado!`);
    fecharModalEditarProduto();
    updateLowStockList();
}

function temPermissao(acao) {
    if (sessionStorage.getItem('userRole') === 'admin') return true;
    const logado = sessionStorage.getItem('usuarioLogado');
    let usuarios = obterDados('usuarios') || [];
    const user = usuarios.find(u => u.usuario === logado);
    if (user && user.permissoes && user.permissoes[acao]) return true;
    return false;
}

// ==========================================
// IMPORTAÇÃO / EXPORTAÇÃO DE BACKUP
// ==========================================
function exportarBackup() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      data[key] = localStorage.getItem(key);
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `backup_completo_bekas_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

function importarBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            dadosImportacaoPendente = JSON.parse(e.target.result);
            const modal = document.getElementById('modal-confirm-import');
            if(modal) modal.style.display = 'flex';
        } catch (error) {
            console.error(error);
            showMessage("Ficheiro de backup inválido ou corrompido!", true);
        }
        const inputBackup = document.getElementById('inputBackup');
        if(inputBackup) inputBackup.value = ''; 
    };
    reader.readAsText(file);
}

function executarImportacao() {
    fecharModal('modal-confirm-import');
    if (!dadosImportacaoPendente) return;

    const msgBox = document.getElementById("mensagemBaixa");
    if (msgBox) {
        msgBox.style.display = "block";
        msgBox.style.opacity = "1";
    }

    for (const key in dadosImportacaoPendente) {
        let valor = dadosImportacaoPendente[key];
        if (typeof valor === 'object' && valor !== null) {
            valor = JSON.stringify(valor);
        }
        localStorage.setItem(key, valor);
    }

    let segundos = 3;
    if (msgBox) msgBox.innerText = `⏳ Sincronizando com a Nuvem... Concluindo em ${segundos}s`;

    const timer = setInterval(() => {
        segundos--;
        if (msgBox) msgBox.innerText = `⏳ Sincronizando com a Nuvem... Concluindo em ${segundos}s`;

        if (segundos <= 0) {
            clearInterval(timer);
            if (msgBox) msgBox.style.display = "none";
            const modal = document.getElementById('modal-sucesso-import');
            if(modal) modal.style.display = 'flex';
        }
    }, 1000);
}

// ==========================================
// APAGAR DADOS (RESET TOTAL)
// ==========================================
function confirmarApagarDados() {
    if (!temPermissao('apagar_tudo')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modal-confirm-apagar');
    if(modal) modal.style.display = 'flex';
}

function pedirSenhaApagar() {
    fecharModal('modal-confirm-apagar');
    const input = document.getElementById('input-senha-apagar');
    const modal = document.getElementById('modal-senha-apagar');
    
    if(input) input.value = '';
    if(modal) modal.style.display = 'flex';
    if(input) setTimeout(() => input.focus(), 100);
}

function executarApagarDados() {
    const input = document.getElementById('input-senha-apagar');
    if(!input) return;
    
    const senha = input.value;
    const senhasSys = obterDados("senhasSistema") || { master: "1996" };
    
    if (senha === senhasSys.master) { 
        fecharModal('modal-senha-apagar');
        
        const msgBox = document.getElementById("mensagemBaixa");
        if (msgBox) {
            msgBox.innerText = "⏳ Sincronizando exclusão com a Nuvem. Aguarde...";
            msgBox.style.display = "block";
            msgBox.style.opacity = "1";
        }

        let usuarios = [{ usuario: "admin", senha: "1996", role: "admin" }];
        
        salvarDados("produtos", {});
        salvarDados("movimentacoes", {});
        salvarDados("pedidosCozinha", {});
        salvarDados("clientesFidelidade", {});
        salvarDados("clientesFiado", {});
        salvarDados("resumoFormas", { Pix: 0, Crédito: 0, Débito: 0, Dinheiro: 0, Cheque: 0, VR: 0, Misto: 0 });
        salvarDados("usuarios", usuarios);
        
        salvarDados("numeroPedidoAtual", 1);
        salvarDados("valorAberturaCaixa", 0);
        salvarDados("caixaAbertoData", null);
        salvarDados("statusCaixaAberto", false);
        salvarDados("ultimaVenda", null);
        
        localStorage.removeItem("caixa_aberto_status");
        localStorage.removeItem("caixa_valor_abertura");

        setTimeout(function() {
            if (msgBox) msgBox.style.display = "none";
            const modal = document.getElementById('modal-sucesso-apagar');
            if(modal) modal.style.display = 'flex';
        }, 2000);

    } else {
        showMessage("Palavra-passe incorreta. Operação cancelada.", true);
        fecharModal('modal-senha-apagar');
    }
}

// ==========================================
// CONFIGURAÇÕES DA EMPRESA E UTILIZADORES
// ==========================================
function toggleFidelidadeConfig() {
    let chk = document.getElementById('emp-usar-fidelidade');
    let divOpcoes = document.getElementById('config-fidelidade-opcoes');
    if(chk && divOpcoes) divOpcoes.style.display = chk.checked ? 'block' : 'none';
}

function abrirModalConfigEmpresa() {
    if (!temPermissao('config_empresa')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modalConfigEmpresa');
    if (!modal) return;

    let config = obterDados("configEmpresa") || { 
        usarMonitorCozinha: false, usarNumeroPedido: true, tamanhoImpressora: "58", 
        usarFidelidade: false, fidelidadeMeta: 10, fidelidadeBrinde: "", usarEstoqueNegativo: false,
        usarFiado: true, usarBuscaNome: false, usarQrPix: false, usarAvisoEstoque: true
    };
    
    if(document.getElementById('emp-nome-cabecalho')) document.getElementById('emp-nome-cabecalho').value = config.nomeCabecalho || "🛒 BEKAS BURGUER - Estoque";
    if(document.getElementById('emp-usar-monitor-cozinha')) document.getElementById('emp-usar-monitor-cozinha').checked = config.usarMonitorCozinha;
    if(document.getElementById('emp-usar-numero-pedido')) document.getElementById('emp-usar-numero-pedido').checked = config.usarNumeroPedido !== false;
    if(document.getElementById('emp-tamanho-impressora')) document.getElementById('emp-tamanho-impressora').value = config.tamanhoImpressora || "58";
    if(document.getElementById('emp-usar-backup')) document.getElementById('emp-usar-backup').checked = config.usarBackup !== false;
    if(document.getElementById('emp-usar-modal-cliente')) document.getElementById('emp-usar-modal-cliente').checked = config.usarModalCliente !== false;
    
    let chkNegativo = document.getElementById('emp-usar-estoque-negativo');
    if (chkNegativo) chkNegativo.checked = config.usarEstoqueNegativo === true;

    let chkBuscaNome = document.getElementById('emp-usar-busca-nome');
    if (chkBuscaNome) chkBuscaNome.checked = config.usarBuscaNome === true;
    
    let chkAvisoEstoque = document.getElementById('emp-usar-aviso-estoque');
    if (chkAvisoEstoque) chkAvisoEstoque.checked = config.usarAvisoEstoque !== false;

    let chkPix = document.getElementById('emp-usar-qr-pix');
    if (chkPix) {
        chkPix.checked = config.usarQrPix === true;
        document.getElementById('config-qr-pix').style.display = config.usarQrPix ? 'block' : 'none';
    }
    
    if (localStorage.getItem("qrCodePix") && document.getElementById("status-qr-pix")) {
        document.getElementById("status-qr-pix").style.display = "block";
    }

    let chkFiado = document.getElementById('emp-usar-fiado');
    if (chkFiado) chkFiado.checked = config.usarFiado !== false;

    let chkFid = document.getElementById('emp-usar-fidelidade');
    if (chkFid) {
        chkFid.checked = config.usarFidelidade === true;
        toggleFidelidadeConfig();
        if(document.getElementById('emp-fidelidade-meta')) document.getElementById('emp-fidelidade-meta').value = config.fidelidadeMeta || 10;
        
        let selectBrinde = document.getElementById('emp-fidelidade-brinde');
        if(selectBrinde) {
            selectBrinde.innerHTML = '<option value="">-- Escolha o Brinde --</option>';
            let prods = obterDados("produtos") || {};
            Object.keys(prods).forEach(codigo => {
                selectBrinde.innerHTML += `<option value="${prods[codigo].nome}">${prods[codigo].nome}</option>`;
            });
            selectBrinde.value = config.fidelidadeBrinde || "";
        }
    }
    
    modal.style.display = 'flex';
}

function salvarConfigEmpresa() {
    let config = obterDados("configEmpresa") || {};
    
    const nomeEl = document.getElementById('emp-nome-cabecalho');
    config.nomeCabecalho = nomeEl ? nomeEl.value.trim() : "🛒 BEKAS BURGUER - Estoque";
    
    config.usarMonitorCozinha = document.getElementById('emp-usar-monitor-cozinha') ? document.getElementById('emp-usar-monitor-cozinha').checked : false;
    config.usarNumeroPedido = document.getElementById('emp-usar-numero-pedido') ? document.getElementById('emp-usar-numero-pedido').checked : true;
    config.tamanhoImpressora = document.getElementById('emp-tamanho-impressora') ? document.getElementById('emp-tamanho-impressora').value : "58";
    config.usarBackup = document.getElementById('emp-usar-backup') ? document.getElementById('emp-usar-backup').checked : true;
    config.usarModalCliente = document.getElementById('emp-usar-modal-cliente') ? document.getElementById('emp-usar-modal-cliente').checked : true;
    
    let chkNegativo = document.getElementById('emp-usar-estoque-negativo');
    config.usarEstoqueNegativo = chkNegativo ? chkNegativo.checked : false;

    let chkBuscaNome = document.getElementById('emp-usar-busca-nome');
    config.usarBuscaNome = chkBuscaNome ? chkBuscaNome.checked : false;
    
    let chkAvisoEstoque = document.getElementById('emp-usar-aviso-estoque');
    config.usarAvisoEstoque = chkAvisoEstoque ? chkAvisoEstoque.checked : true;

    let chkPix = document.getElementById('emp-usar-qr-pix');
    config.usarQrPix = chkPix ? chkPix.checked : false;

    let chkFiado = document.getElementById('emp-usar-fiado');
    config.usarFiado = chkFiado ? chkFiado.checked : true;

    let chkFid = document.getElementById('emp-usar-fidelidade');
    config.usarFidelidade = chkFid ? chkFid.checked : false;
    
    if(document.getElementById('emp-fidelidade-meta')) config.fidelidadeMeta = parseInt(document.getElementById('emp-fidelidade-meta').value) || 10;
    if(document.getElementById('emp-fidelidade-brinde')) config.fidelidadeBrinde = document.getElementById('emp-fidelidade-brinde').value || "";
    
    salvarDados("configEmpresa", config);
    showMessage("Configurações da Empresa salvas com sucesso!");
    fecharModal('modalConfigEmpresa');
    aplicarConfiguracoesEmpresaGeral();
    aplicarPermissoesPainel();
}

function salvarImagemQRPix() {
    var fileInput = document.getElementById('input-qr-pix');
    if(!fileInput) return;
    
    var file = fileInput.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                localStorage.setItem("qrCodePix", e.target.result);
                document.getElementById("status-qr-pix").style.display = "block";
                showMessage("QR Code Pix salvo com sucesso!");
            } catch (err) { showMessage("A imagem é muito pesada. Tente uma com tamanho menor.", true); }
        };
        reader.readAsDataURL(file);
    } else { showMessage("Selecione uma imagem primeiro.", true); }
}

function removerImagemQRPix() {
    localStorage.removeItem("qrCodePix");
    document.getElementById("input-qr-pix").value = "";
    document.getElementById("status-qr-pix").style.display = "none";
    showMessage("QR Code removido.");
}

function aplicarConfiguracoesEmpresaGeral() {
    let config = obterDados("configEmpresa") || {};
    let nomeHeader = config.nomeCabecalho || "🛒 BEKAS BURGUER - Estoque";
    let elHeader = document.getElementById("header-nome-empresa") || document.querySelector(".header-logo span");
    if(elHeader) elHeader.innerText = nomeHeader;
}

function abrirModalSenhasSistema() {
    if (sessionStorage.getItem('userRole') !== 'admin') return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modalSenhasSistema');
    if(!modal) return;
    
    let senhas = obterDados("senhasSistema") || { master: "1996", cancelarItem: "2201", fecharCaixa: "2201" };
    if(document.getElementById('senha-sys-master')) document.getElementById('senha-sys-master').value = senhas.master;
    if(document.getElementById('senha-sys-cancelar')) document.getElementById('senha-sys-cancelar').value = senhas.cancelarItem;
    if(document.getElementById('senha-sys-fechar')) document.getElementById('senha-sys-fechar').value = senhas.fecharCaixa;
    
    modal.style.display = 'flex';
}

function salvarSenhasSistema() {
    const masterEl = document.getElementById('senha-sys-master');
    const cancelEl = document.getElementById('senha-sys-cancelar');
    const fecharEl = document.getElementById('senha-sys-fechar');
    
    let senhas = {
        master: masterEl ? masterEl.value.trim() : "1996",
        cancelarItem: cancelEl ? cancelEl.value.trim() : "2201",
        fecharCaixa: fecharEl ? fecharEl.value.trim() : "2201"
    };
    
    salvarDados("senhasSistema", senhas);
    showMessage("Palavras-passe de segurança atualizadas!");
    fecharModal('modalSenhasSistema');
}

function verificarAdmin() {
    let usuarios = obterDados('usuarios') || [];
    if (!usuarios.find(u => u.usuario === 'admin')) {
        usuarios.push({ usuario: 'admin', senha: '1996', role: 'admin' });
        salvarDados('usuarios', usuarios);
    }
}
verificarAdmin(); 

function abrirModalCriarUsuario() {
    if (!temPermissao('criar_usuario')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modal-criar-usuario');
    if(!modal) return;
    
    if(document.getElementById('novo-usuario-nome')) document.getElementById('novo-usuario-nome').value = '';
    if(document.getElementById('novo-usuario-senha')) document.getElementById('novo-usuario-senha').value = '';
    modal.style.display = 'flex';
}

function criarUsuario() {
    const nomeEl = document.getElementById('novo-usuario-nome');
    const senhaEl = document.getElementById('novo-usuario-senha');
    
    if(!nomeEl || !senhaEl) return;
    
    const nome = nomeEl.value.trim();
    const senha = senhaEl.value;
    
    if (!nome || !senha) return showMessage("Preencha nome e palavra-passe!", true);
    
    let usuarios = obterDados('usuarios') || [];
    if (usuarios.find(u => u.usuario === nome)) return showMessage("Utilizador já existe!", true);
    
    usuarios.push({ 
        usuario: nome, senha: senha, role: 'operador',
        permissoes: { 
            caixa: false, cupons: false, cozinha: false, fidelidade: false, fiado: false, registrar_produto: false, todos_produtos: false, 
            verificar_quantidade: false, fim_estoque: false, faturamento: false, relatorio: false, 
            conectar_firebase: false, apagar_tudo: false, config_empresa: false, criar_usuario: false, 
            editar_usuario: false, excluir_usuario: false, ver_usuarios: false 
        }
    });
    
    salvarDados('usuarios', usuarios);
    showMessage("Utilizador criado com sucesso!");
    fecharModal('modal-criar-usuario');
}

function abrirModalEditarUsuario() {
    if (!temPermissao('editar_usuario')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modal-editar-usuario');
    const select = document.getElementById('select-editar-usuario');
    
    if(!modal || !select) return;
    
    let usuarios = obterDados('usuarios') || [];
    select.innerHTML = '<option value="">-- Selecione --</option>';
    
    usuarios.forEach(u => {
        if (u.usuario !== 'admin') {
            select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
        }
    });
    
    if(document.getElementById('editar-usuario-nova-senha')) document.getElementById('editar-usuario-nova-senha').value = '';
    modal.style.display = 'flex';
}

function editarUsuario() {
    const select = document.getElementById('select-editar-usuario');
    const senhaEl = document.getElementById('editar-usuario-nova-senha');
    if(!select || !senhaEl) return;
    
    const nome = select.value;
    const novaSenha = senhaEl.value;
    
    if (!nome || !novaSenha) return showMessage("Preencha todos os campos!", true);
    if (nome === 'admin') return showMessage("Operação não permitida para a conta Admin.", true);
    
    let usuarios = obterDados('usuarios') || [];
    const index = usuarios.findIndex(u => u.usuario === nome);
    if (index !== -1) {
        usuarios[index].senha = novaSenha;
        salvarDados('usuarios', usuarios);
        showMessage("Palavra-passe atualizada!");
        fecharModal('modal-editar-usuario');
    }
}

function abrirModalExcluirUsuario() {
    if (!temPermissao('excluir_usuario')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modal-excluir-usuario');
    const select = document.getElementById('select-excluir-usuario');
    
    if(!modal || !select) return;
    
    let usuarios = obterDados('usuarios') || [];
    select.innerHTML = '<option value="">-- Selecione --</option>';
    usuarios.forEach(u => {
        if (u.usuario !== 'admin') select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
    });
    
    modal.style.display = 'flex';
}

function excluirUsuario() {
    const select = document.getElementById('select-excluir-usuario');
    if(!select) return;
    
    const nome = select.value;
    if (!nome) return showMessage("Selecione um utilizador!", true);
    if (nome === 'admin') return showMessage("O Admin não pode ser excluído.", true);
    
    let usuarios = obterDados('usuarios') || [];
    usuarios = usuarios.filter(u => u.usuario !== nome);
    salvarDados('usuarios', usuarios);
    showMessage("Utilizador excluído!");
    fecharModal('modal-excluir-usuario');
}

function abrirModalListarUsuarios() {
    if (!temPermissao('ver_usuarios')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modal-listar-usuarios');
    const divLista = document.getElementById('lista-de-usuarios-cadastrados');
    
    if(!modal || !divLista) return;
    
    let usuarios = obterDados('usuarios') || [];
    divLista.innerHTML = '';
    
    usuarios.forEach(u => {
        let displaySenha = u.usuario === 'admin' ? '********' : u.senha;
        divLista.innerHTML += `<div style="padding: 10px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center;">
            <div><strong>${u.usuario}</strong> <br><span style="color: #777; font-size: 11px;">(${u.role === 'admin' ? 'Administrador' : 'Operador'})</span></div>
            <div style="background: #f1f1f1; padding: 5px 10px; border-radius: 5px; font-family: monospace; border: 1px solid #ccc;">Senha: <b>${displaySenha}</b></div>
        </div>`;
    });
    modal.style.display = 'flex';
}

function abrirModalPermissoes() {
    if (sessionStorage.getItem('userRole') !== 'admin') return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modalPermissoes');
    const select = document.getElementById('selectUsuarioPermissao');
    const lista = document.getElementById('listaPermissoes');
    
    if(!modal || !select) return;
    
    let usuarios = obterDados('usuarios') || [];
    select.innerHTML = '<option value="">-- Escolha um Operador --</option>';
    usuarios.forEach(u => {
        if (u.usuario !== 'admin') select.innerHTML += `<option value="${u.usuario}">${u.usuario}</option>`;
    });
    
    if(lista) lista.style.display = 'none';
    modal.style.display = 'flex';
}

function carregarPermissoesUsuario() {
    const select = document.getElementById('selectUsuarioPermissao');
    const divLista = document.getElementById('listaPermissoes');
    if(!select || !divLista) return;
    
    const nome = select.value;
    if (!nome) { divLista.style.display = 'none'; return; }
    
    divLista.style.display = 'block';
    let usuarios = obterDados('usuarios') || [];
    const user = usuarios.find(u => u.usuario === nome);
    const p = (user && user.permissoes) ? user.permissoes : {};

    const permissoesArray = [
        'caixa', 'cupons', 'cozinha', 'fidelidade', 'fiado', 'registrar_produto', 
        'todos_produtos', 'verificar_quantidade', 'fim_estoque', 'faturamento', 
        'relatorio', 'conectar_firebase', 'apagar_tudo', 'config_empresa', 
        'criar_usuario', 'editar_usuario', 'excluir_usuario', 'ver_usuarios'
    ];

    permissoesArray.forEach(k => {
        const el = document.getElementById('perm-' + k);
        if (el) el.checked = p[k] || false;
    });
}

function salvarPermissoesUsuario() {
    const select = document.getElementById('selectUsuarioPermissao');
    if(!select) return;
    
    const nome = select.value;
    if (!nome) return showMessage("Selecione um utilizador primeiro.", true);
    
    let usuarios = obterDados('usuarios') || [];
    const index = usuarios.findIndex(u => u.usuario === nome);
    
    if (index !== -1) {
        let novasPermissoes = {};
        const permissoesArray = [
            'caixa', 'cupons', 'cozinha', 'fidelidade', 'fiado', 'registrar_produto', 
            'todos_produtos', 'verificar_quantidade', 'fim_estoque', 'faturamento', 
            'relatorio', 'conectar_firebase', 'apagar_tudo', 'config_empresa', 
            'criar_usuario', 'editar_usuario', 'excluir_usuario', 'ver_usuarios'
        ];

        permissoesArray.forEach(k => {
            const el = document.getElementById('perm-' + k);
            if (el) {
                novasPermissoes[k] = el.checked;
            } else {
                novasPermissoes[k] = usuarios[index].permissoes ? (usuarios[index].permissoes[k] || false) : false;
            }
        });

        usuarios[index].permissoes = novasPermissoes;
        salvarDados('usuarios', usuarios);
        showMessage(`Permissões salvas com sucesso!`);
        fecharModal('modalPermissoes');
    }
}

function aplicarPermissoesPainel() {
    const role = sessionStorage.getItem('userRole');
    let configEmp = obterDados("configEmpresa") || { usarBackup: true, usarMonitorCozinha: false, usarFidelidade: false, usarFiado: true };
    
    let modSaaS = JSON.parse(localStorage.getItem('saas_modulos') || "{}");
    const isAtivoSaaS = (modName) => modSaaS[modName] !== false; 

    if (document.getElementById('btn-backup-export')) document.getElementById('btn-backup-export').style.display = configEmp.usarBackup ? 'inline-block' : 'none';
    if (document.getElementById('btn-backup-import')) document.getElementById('btn-backup-import').style.display = configEmp.usarBackup ? 'inline-block' : 'none';

    if (role === 'admin') {
        // Regra do Admin: Vê a cozinha apenas dependendo da configuração da empresa
        if (document.getElementById('card-cozinha')) {
            document.getElementById('card-cozinha').style.display = (configEmp.usarMonitorCozinha && isAtivoSaaS('mod_cozinha')) ? 'block' : 'none';
        }

        if (!localStorage.getItem("firebaseConfigJSON") && document.getElementById("alerta-firebase")) {
            document.getElementById("alerta-firebase").style.display = "block";
        }
        
        if(document.getElementById('zona-apagar-tudo')) document.getElementById('zona-apagar-tudo').style.display = isAtivoSaaS('mod_apagar_tudo') ? 'block' : 'none';
        if(document.getElementById('btn-menu-config-emp')) document.getElementById('btn-menu-config-emp').style.display = isAtivoSaaS('mod_admin_config') ? 'block' : 'none';
        if(document.getElementById('btn-menu-criar-usu')) document.getElementById('btn-menu-criar-usu').style.display = isAtivoSaaS('mod_admin_usuarios') ? 'block' : 'none';
        if(document.getElementById('btn-menu-editar-usu')) document.getElementById('btn-menu-editar-usu').style.display = isAtivoSaaS('mod_admin_usuarios') ? 'block' : 'none';
        if(document.getElementById('btn-menu-excluir-usu')) document.getElementById('btn-menu-excluir-usu').style.display = isAtivoSaaS('mod_admin_usuarios') ? 'block' : 'none';
        if(document.getElementById('btn-menu-ver-usu')) document.getElementById('btn-menu-ver-usu').style.display = isAtivoSaaS('mod_admin_usuarios') ? 'block' : 'none';
        if(document.getElementById('btn-menu-conectar-firebase')) document.getElementById('btn-menu-conectar-firebase').style.display = isAtivoSaaS('mod_admin_firebase') ? 'block' : 'none';
        
        let temMenuUsu = isAtivoSaaS('mod_admin_usuarios') || isAtivoSaaS('mod_admin_config');
        if(document.getElementById('separador-menu-usu')) document.getElementById('separador-menu-usu').style.display = temMenuUsu ? 'block' : 'none';
        
        if(document.getElementById('card-caixa')) document.getElementById('card-caixa').style.display = isAtivoSaaS('mod_caixa') ? 'block' : 'none';
        if(document.getElementById('card-cupons')) document.getElementById('card-cupons').style.display = isAtivoSaaS('mod_cupons') ? 'block' : 'none';
        if(document.getElementById('card-fidelidade')) document.getElementById('card-fidelidade').style.display = (configEmp.usarFidelidade && isAtivoSaaS('mod_fidelidade')) ? 'block' : 'none';
        if(document.getElementById('card-fiado')) document.getElementById('card-fiado').style.display = (configEmp.usarFiado !== false && isAtivoSaaS('mod_fiado')) ? 'block' : 'none';
        if(document.getElementById('card-gerenciar_produto')) document.getElementById('card-gerenciar_produto').style.display = isAtivoSaaS('mod_registrar_produto') ? 'block' : 'none';
        if(document.getElementById('card-todos_produtos')) document.getElementById('card-todos_produtos').style.display = isAtivoSaaS('mod_todos_produtos') ? 'block' : 'none';
        if(document.getElementById('card-verificar_quantidade')) document.getElementById('card-verificar_quantidade').style.display = isAtivoSaaS('mod_verificar_quantidade') ? 'block' : 'none';
        if(document.getElementById('card-fim_estoque')) document.getElementById('card-fim_estoque').style.display = isAtivoSaaS('mod_fim_estoque') ? 'block' : 'none';
        if(document.getElementById('card-faturamento')) document.getElementById('card-faturamento').style.display = isAtivoSaaS('mod_faturamento') ? 'block' : 'none';
        if(document.getElementById('card-relatorio')) document.getElementById('card-relatorio').style.display = isAtivoSaaS('mod_relatorios') ? 'block' : 'none';
        
        return; 
    }

    const usuarioLogado = sessionStorage.getItem("usuarioLogado");
    let usuarios = obterDados('usuarios') || [];
    const user = usuarios.find(u => u.usuario === usuarioLogado); 
    const p = (user && user.permissoes) ? user.permissoes : {};

    // Regra do Operador: Exige que a permissão (p.cozinha) também seja verdadeira
    if(document.getElementById('card-cozinha')) document.getElementById('card-cozinha').style.display = (p.cozinha && configEmp.usarMonitorCozinha && isAtivoSaaS('mod_cozinha')) ? 'block' : 'none';

    if(document.getElementById('card-caixa')) document.getElementById('card-caixa').style.display = (p.caixa && isAtivoSaaS('mod_caixa')) ? 'block' : 'none';
    if(document.getElementById('card-cupons')) document.getElementById('card-cupons').style.display = (p.cupons && isAtivoSaaS('mod_cupons')) ? 'block' : 'none';
    if(document.getElementById('card-fidelidade')) document.getElementById('card-fidelidade').style.display = (p.fidelidade && configEmp.usarFidelidade && isAtivoSaaS('mod_fidelidade')) ? 'block' : 'none';
    if(document.getElementById('card-fiado')) document.getElementById('card-fiado').style.display = (p.fiado && configEmp.usarFiado !== false && isAtivoSaaS('mod_fiado')) ? 'block' : 'none';
    if(document.getElementById('card-gerenciar_produto')) document.getElementById('card-gerenciar_produto').style.display = (p.registrar_produto && isAtivoSaaS('mod_registrar_produto')) ? 'block' : 'none';
    if(document.getElementById('card-todos_produtos')) document.getElementById('card-todos_produtos').style.display = (p.todos_produtos && isAtivoSaaS('mod_todos_produtos')) ? 'block' : 'none';
    if(document.getElementById('card-verificar_quantidade')) document.getElementById('card-verificar_quantidade').style.display = (p.verificar_quantidade && isAtivoSaaS('mod_verificar_quantidade')) ? 'block' : 'none';
    if(document.getElementById('card-fim_estoque')) document.getElementById('card-fim_estoque').style.display = (p.fim_estoque && isAtivoSaaS('mod_fim_estoque')) ? 'block' : 'none';
    if(document.getElementById('card-faturamento')) document.getElementById('card-faturamento').style.display = (p.faturamento && isAtivoSaaS('mod_faturamento')) ? 'block' : 'none';
    if(document.getElementById('card-relatorio')) document.getElementById('card-relatorio').style.display = (p.relatorio && isAtivoSaaS('mod_relatorios')) ? 'block' : 'none';

    if(document.getElementById('btn-menu-conectar-firebase')) document.getElementById('btn-menu-conectar-firebase').style.display = (p.conectar_firebase && isAtivoSaaS('mod_admin_firebase')) ? 'block' : 'none';
    if(document.getElementById('zona-apagar-tudo')) document.getElementById('zona-apagar-tudo').style.display = (p.apagar_tudo && isAtivoSaaS('mod_apagar_tudo')) ? 'block' : 'none';
    if(document.getElementById('btn-menu-config-emp')) document.getElementById('btn-menu-config-emp').style.display = (p.config_empresa && isAtivoSaaS('mod_admin_config')) ? 'block' : 'none';
    if(document.getElementById('btn-menu-criar-usu')) document.getElementById('btn-menu-criar-usu').style.display = (p.criar_usuario && isAtivoSaaS('mod_admin_usuarios')) ? 'block' : 'none';
    if(document.getElementById('btn-menu-editar-usu')) document.getElementById('btn-menu-editar-usu').style.display = (p.editar_usuario && isAtivoSaaS('mod_admin_usuarios')) ? 'block' : 'none';
    if(document.getElementById('btn-menu-excluir-usu')) document.getElementById('btn-menu-excluir-usu').style.display = (p.excluir_usuario && isAtivoSaaS('mod_admin_usuarios')) ? 'block' : 'none';
    if(document.getElementById('btn-menu-ver-usu')) document.getElementById('btn-menu-ver-usu').style.display = (p.ver_usuarios && isAtivoSaaS('mod_admin_usuarios')) ? 'block' : 'none';

    if (!p.config_empresa && !p.criar_usuario && !p.editar_usuario && !p.excluir_usuario && !p.ver_usuarios && !p.conectar_firebase) {
        if(document.getElementById('separador-menu-usu')) document.getElementById('separador-menu-usu').style.display = 'none';
    } else {
        if(document.getElementById('separador-menu-usu')) document.getElementById('separador-menu-usu').style.display = 'block';
    }
}

function abrirModalConfigTema() {
    const modal = document.getElementById("modal-configuracoes-tema");
    if(!modal) return;
    
    modal.style.display = "flex";
    if(document.getElementById("cor-fundo-header")) document.getElementById("cor-fundo-header").value = localStorage.getItem("temaCorFundoHeader") || "#2c3e50";
    if(document.getElementById("cor-texto-header")) document.getElementById("cor-texto-header").value = localStorage.getItem("temaCorTextoHeader") || "#ffffff";
}

function salvarCoresTema() {
    const corFundoEl = document.getElementById("cor-fundo-header");
    const corTextoEl = document.getElementById("cor-texto-header");
    
    if(corFundoEl) localStorage.setItem("temaCorFundoHeader", corFundoEl.value);
    if(corTextoEl) localStorage.setItem("temaCorTextoHeader", corTextoEl.value);
    
    aplicarTemaVisual();
    fecharModal('modal-configuracoes-tema');
}

function aplicarTemaVisual() {
    var corFundo = localStorage.getItem("temaCorFundoHeader");
    var corTexto = localStorage.getItem("temaCorTextoHeader");
    var header = document.getElementById("main-header-bar");
    var footer = document.getElementById("main-footer-bar");
    
    if (header) { if (corFundo) header.style.backgroundColor = corFundo; if (corTexto) header.style.color = corTexto; }
    if (footer) { if (corFundo) footer.style.backgroundColor = corFundo; if (corTexto) footer.style.color = corTexto; }
    
    var fundoSalvo = localStorage.getItem("fundoTelaSistema");
    var bodyPainel = document.getElementById("painel-body");
    if (bodyPainel) bodyPainel.style.backgroundImage = fundoSalvo ? "url('" + fundoSalvo + "')" : "none";
    
    var nomeSpan = document.getElementById("nome-usuario-logado");
    if (nomeSpan) nomeSpan.innerText = sessionStorage.getItem("usuarioLogado") || "Operador";
}

function salvarImagemFundo() {
    var fileInput = document.getElementById('input-fundo-tela');
    if(!fileInput) return;
    
    var file = fileInput.files[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement("canvas");
                var ctx = canvas.getContext("2d");
                var MAX_WIDTH = 1920;
                var MAX_HEIGHT = 1080;
                var width = img.width;
                var height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                } else {
                    if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                var dataUrl = canvas.toDataURL("image/jpeg", 0.6);

                try {
                    localStorage.setItem("fundoTelaSistema", dataUrl);
                    aplicarTemaVisual();
                    mostrarAlertaGlobal("Imagem de fundo aplicada com sucesso!");
                } catch (err) { mostrarAlertaGlobal("A imagem ainda é muito pesada. Tente uma foto mais simples.", "Erro"); }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } else { mostrarAlertaGlobal("Selecione uma imagem primeiro.", "Erro"); }
}

function removerImagemFundo() {
    localStorage.removeItem("fundoTelaSistema");
    const fileInput = document.getElementById("input-fundo-tela");
    if(fileInput) fileInput.value = "";
    aplicarTemaVisual();
}

function abrirModalFirebase() {
    if (!temPermissao('conectar_firebase')) return showMessage("Acesso Negado.", true);
    const modal = document.getElementById('modalFirebase');
    if(!modal) return;
    
    modal.style.display = 'flex';
    var configAtual = localStorage.getItem("firebaseConfigJSON");
    if (configAtual && document.getElementById('firebaseConfigInput')) document.getElementById('firebaseConfigInput').value = configAtual;
}

function salvarConfigFirebase() {
    const inputEl = document.getElementById('firebaseConfigInput');
    if(!inputEl) return;
    
    var configStr = inputEl.value.trim();
    if (!configStr) return showMessage("O campo está vazio.", true);
    try {
        JSON.parse(configStr);
        localStorage.setItem("firebaseConfigJSON", configStr);
        mostrarAlertaGlobal("Salvo! Recarregando...");
        window.location.reload();
    } catch (e) { showMessage("Erro: JSON inválido.", true); }
}

document.addEventListener("DOMContentLoaded", () => {
    aplicarTemaVisual();
    aplicarConfiguracoesEmpresaGeral(); 
    aplicarPermissoesPainel();
});

document.addEventListener("bancoPronto", () => {
    produtos = obterDados("produtos") || {};
    updateLowStockList(); 
    aplicarConfiguracoesEmpresaGeral(); 
    aplicarPermissoesPainel();
});

window.abrirModalBloqueioLocal = async () => {
    const modal = document.getElementById('modalBloqueioLocal');
    if(!modal) return;
    modal.style.display = 'flex';
    
    if (typeof window.db !== 'undefined' && typeof window.doc !== 'undefined' && typeof window.getDoc !== 'undefined') {
        try {
            const licencaRef = window.doc(window.db, "config", "licenca");
            const docSnap = await window.getDoc(licencaRef);
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(document.getElementById('check-bloquear-local')) document.getElementById('check-bloquear-local').checked = dados.bloqueado || false;
                if(document.getElementById('texto-bloqueio-local')) document.getElementById('texto-bloqueio-local').value = dados.mensagem || "";
            }
        } catch (e) {
            console.error("Erro Firebase: ", e);
        }
    } else {
        console.warn("Módulo Firebase ausente no escopo global.");
    }
};

window.salvarBloqueioLocal = async () => {
    const checkEl = document.getElementById('check-bloquear-local');
    const txtEl = document.getElementById('texto-bloqueio-local');
    if(!checkEl || !txtEl) return;
    
    const bloqueado = checkEl.checked;
    const mensagem = txtEl.value;
    
    if (typeof window.db !== 'undefined' && typeof window.doc !== 'undefined' && typeof window.setDoc !== 'undefined') {
        try {
            await window.setDoc(window.doc(window.db, "config", "licenca"), {
                bloqueado: bloqueado,
                mensagem: mensagem,
                atualizadoEm: new Date()
            }, { merge: true });
            
            fecharModal('modalBloqueioLocal');
        } catch(e) {
            mostrarAlertaGlobal("Erro ao salvar bloqueio: " + e.message, "Erro");
        }
    } else {
        mostrarAlertaGlobal("Módulo Firebase não encontrado globalmente.", "Erro");
    }
};
