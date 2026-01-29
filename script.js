const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzHjliamfyBfksrn2GjCR71o5Y9-gkHvJ3xqXMmSunRDtmbwcx8wbgJyaDY2AlgUsqz-Q/exec";
  
// Estado do sistema
let usuarioLogado = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let canvas, ctx;
let enviando = false;
let meusFeedbacks = [];
let currentFeedbacksPage = 1;
let feedbacksPerPage = 10;
let visualizacaoAtual = 'cards'; // 'cards' ou 'tabela'

// Configurações para otimização da assinatura
const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 150;
const LINE_WIDTH = 2;

// ===== FUNÇÕES DE LOGIN SEGURO =====

/**
 * Mostra o estado de carregamento no login
 */
function showLoginLoading() {
  const error = document.getElementById('loginError');
  const success = document.getElementById('loginSuccess');
  const btn = document.querySelector('#loginForm button[type="submit"]');
  
  if (error) error.style.display = 'none';
  if (success) success.style.display = 'none';
  
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
  }
}

/**
 * Esconde o estado de carregamento no login
 */
function hideLoginLoading() {
  const loading = document.getElementById('loginLoading');
  const btn = document.querySelector('#loginForm button[type="submit"]');
  
  if (loading) loading.style.display = 'none';
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Acessar Sistema';
  }
}

/**
 * Mostra mensagem de erro no login
 */
function showLoginError(message) {
  const error = document.getElementById('loginError');
  const errorText = document.getElementById('errorText');
  
  if (error && errorText) {
    errorText.textContent = message;
    error.style.display = 'block';
    error.style.animation = 'shake 0.5s';
    
    setTimeout(() => {
      error.style.animation = '';
    }, 500);
  }
}

/**
 * Mostra mensagem de sucesso no login
 */
function showLoginSuccess() {
  const success = document.getElementById('loginSuccess');
  if (success) {
    success.style.display = 'block';
  }
}

/**
 * Formata o nome do usuário a partir do email
 */
function formatarNomeUsuario(email) {
  let nome = email.split('@')[0];
  nome = nome.replace(/[._]/g, ' ');
  return nome
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Faz login verificando REALMENTE no Google Sheets (Aba CADASTRO)
 */
async function fazerLogin(email) {
  try {
    showLoginLoading();
    
    // Verifica formato básico
    if (!email || !email.includes('@')) {
      hideLoginLoading();
      return { success: false, message: "Email inválido." };
    }

    // PREPARAÇÃO: Cria os dados para enviar ao GS
    const payload = {
      action: 'login',
      email: email.trim()
    };

    // ENVIO: Manda os dados para o Google Script
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Erro HTTP: ${response.status}`);
    }

    // RESPOSTA: Recebe o "Sim" ou "Não" da planilha
    const resultado = await response.json();
    
    hideLoginLoading();
    return resultado;

  } catch (error) {
    console.error('Erro no login:', error);
    hideLoginLoading();
    return { 
      success: false, 
      message: "Erro de conexão. Verifique se o Deploy está atualizado." 
    };
  }
}

/**
 * Processa o login completo
 */
async function processarLogin(email) {
  // Validar formato do email
  if (!email.includes('@') || !email.includes('.')) {
    showLoginError("Por favor, insira um e-mail válido");
    return;
  }
  
  const resultado = await fazerLogin(email);
  
  if (resultado.success) {
    // Login bem-sucedido
    usuarioLogado = {
      email: email,
      nome: resultado.nome
    };
    
    // Mostrar mensagem de sucesso
    showLoginSuccess();
    
    // Aguardar um pouco para mostrar a mensagem de sucesso
    setTimeout(() => {
      // Transição para o app
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'block';
      document.getElementById('loggedUser').textContent = usuarioLogado.nome;
      
      // Inicializar componentes do sistema
      initializeSignature();
      carregarColaboradores();
      updateNotaDisplay(document.getElementById('nota').value);
      setupNavigation();
      setupMobileNavigation();
    }, 1000);
    
  } else {
    // Login falhou
    showLoginError(resultado.message || "E-mail não autorizado no sistema");
  }
}

/**
 * Verifica se há sessão ativa e restaura
 */
async function verificarSessaoAtiva() {
  const usuarioSalvo = sessionStorage.getItem('feedback_usuario');
  if (usuarioSalvo) {
    try {
      usuarioLogado = JSON.parse(usuarioSalvo);
      
      // Fazer verificação rápida
      const resultado = await fazerLogin(usuarioLogado.email);
      
      if (resultado.success) {
        // Login automático bem-sucedido
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('appScreen').style.display = 'block';
        document.getElementById('loggedUser').textContent = usuarioLogado.nome;
        
        // Inicializar componentes
        setTimeout(() => {
          initializeSignature();
          carregarColaboradores();
          updateNotaDisplay(document.getElementById('nota').value);
          setupNavigation();
          setupMobileNavigation();
        }, 100);
        return true;
      } else {
        // Sessão expirada ou não autorizada
        sessionStorage.removeItem('feedback_usuario');
        usuarioLogado = null;
        document.getElementById('loginScreen').style.display = 'block';
        document.getElementById('appScreen').style.display = 'none';
        return false;
      }
    } catch (error) {
      // Erro ao recuperar sessão
      sessionStorage.removeItem('feedback_usuario');
      document.getElementById('loginScreen').style.display = 'block';
      document.getElementById('appScreen').style.display = 'none';
      return false;
    }
  }
  return false;
}

// ===== INICIALIZAÇÃO DO SISTEMA =====

// Evento de submit do formulário de login
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value.trim();
  await processarLogin(email);
});

// Inicialização ao carregar a página
window.addEventListener('load', async function() {
  // Verificar se já está logado
  const temSessao = await verificarSessaoAtiva();
  
  if (!temSessao) {
    // Não está logado
    document.getElementById('loginScreen').style.display = 'block';
    document.getElementById('appScreen').style.display = 'none';
    
    // Focar no campo de email
    setTimeout(() => {
      document.getElementById('loginEmail').focus();
    }, 500);
  }
});

// ===== FUNÇÕES PARA NAVEGAÇÃO MOBILE =====
function setupMobileNavigation() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const mobileOverlay = document.getElementById('mobileOverlay');
  
  mobileMenuBtn.addEventListener('click', function() {
    sidebar.classList.toggle('mobile-visible');
    mobileOverlay.classList.toggle('visible');
    document.body.style.overflow = sidebar.classList.contains('mobile-visible') ? 'hidden' : 'auto';
  });
  
  mobileOverlay.addEventListener('click', function() {
    sidebar.classList.remove('mobile-visible');
    mobileOverlay.classList.remove('visible');
    document.body.style.overflow = 'auto';
  });
  
  // Fechar menu ao clicar em um link
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function() {
      if (window.innerWidth < 768) {
        sidebar.classList.remove('mobile-visible');
        mobileOverlay.classList.remove('visible');
        document.body.style.overflow = 'auto';
      }
    });
  });
}

function setupNavigation() {
  const navLinks = document.querySelectorAll('.nav-link[data-page]');
  
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const pageId = this.getAttribute('data-page');
      
      // Remover classe active de todos
      navLinks.forEach(l => l.classList.remove('active'));
      // Adicionar classe active ao link clicado
      this.classList.add('active');
      
      // Esconder todas as páginas
      document.querySelectorAll('.page-content').forEach(page => {
        page.style.display = 'none';
        page.classList.remove('active');
      });
      
      // Mostrar página selecionada
      const targetPage = document.getElementById(`page-${pageId}`);
      if (targetPage) {
        targetPage.style.display = 'block';
        targetPage.classList.add('active');
      }
      
      // Carregar dados específicos da página
      switch(pageId) {
        case 'meus-feedbacks':
          carregarMeusFeedbacks();
          break;
        case 'relatorios':
          gerarRelatorios();
          break;
        case 'feedback':
          // Já está carregado
          break;
      }
    });
  });
  
  // Botão de logout
  document.getElementById('btnLogout').addEventListener('click', function(e) {
    e.preventDefault();
    logout();
  });
}

function logout() {
  Swal.fire({
    title: 'Sair do sistema?',
    text: 'Você será redirecionado para a tela de login.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#e53935',
    cancelButtonColor: '#6c757d',
    confirmButtonText: 'Sim, sair',
    cancelButtonText: 'Cancelar'
  }).then((result) => {
    if (result.isConfirmed) {
      sessionStorage.removeItem('feedback_usuario');
      usuarioLogado = null;
      document.getElementById('loginScreen').style.display = 'block';
      document.getElementById('appScreen').style.display = 'none';
      document.getElementById('loginEmail').value = '';
      
      // Limpar mensagens de feedback
      const error = document.getElementById('loginError');
      const success = document.getElementById('loginSuccess');
      if (error) error.style.display = 'none';
      if (success) success.style.display = 'none';
      
      // Focar no campo de email
      setTimeout(() => {
        document.getElementById('loginEmail').focus();
      }, 300);
    }
  });
}

// ===== FUNÇÕES PARA NOTA =====
function updateNotaDisplay(valor) {
  const notaValue = document.getElementById('notaValue');
  const notaIndicator = document.getElementById('notaIndicator');
  const notaTexto = document.getElementById('notaTexto');
  
  notaValue.textContent = valor + '/10';
  
  let cor, texto;
  if (valor <= 3) {
    cor = 'linear-gradient(135deg, #e53935, #d32f2f)';
    texto = 'Baixo - Precisa de Melhoria';
  } else if (valor <= 5) {
    cor = 'linear-gradient(135deg, #ff6f00, #f57c00)';
    texto = 'Regular - Abaixo do Esperado';
  } else if (valor <= 7) {
    cor = 'linear-gradient(135deg, #ff8a00, #ff9800)';
    texto = 'Bom - Atende Expectativas';
  } else if (valor <= 9) {
    cor = 'linear-gradient(135deg, #ff9100, #ffab00)';
    texto = 'Ótimo - Acima da Média';
  } else {
    cor = 'linear-gradient(135deg, #ffab00, #ffc400)';
    texto = 'Excelente - Fora da Curva';
  }
  
  notaValue.style.background = cor;
  
  // Atualizar indicador se existir
  if (notaIndicator) {
    if (valor <= 3) {
      notaIndicator.style.background = 'var(--shoppe-red)';
    } else if (valor <= 7) {
      notaIndicator.style.background = 'var(--shoppe-orange)';
    } else {
      notaIndicator.style.background = 'var(--shoppe-yellow)';
    }
  }
  
  // Atualizar texto se existir
  if (notaTexto) {
    notaTexto.textContent = texto;
  }
}

// ===== INICIALIZAÇÃO DA ASSINATURA OTIMIZADA =====
function initializeSignature() {
  canvas = document.getElementById('signatureCanvas');
  ctx = canvas.getContext('2d');
  
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#e53935';
  
  clearCanvas();
  
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);
  
  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', stopDrawing);
}

// ===== FUNÇÕES DA ASSINATURA OTIMIZADAS =====
function clearCanvas() {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#ffcdd2';
  ctx.font = 'italic 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Assine aqui', canvas.width / 2, canvas.height / 2);
}

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function getTouchPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  return {
    x: (e.touches[0].clientX - rect.left) * scaleX,
    y: (e.touches[0].clientY - rect.top) * scaleY
  };
}

function startDrawing(e) {
  e.preventDefault();
  isDrawing = true;
  const pos = e.type.includes('mouse') ? getMousePos(e) : getTouchPos(e);
  [lastX, lastY] = [pos.x, pos.y];
  
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  
  const pos = e.type.includes('mouse') ? getMousePos(e) : getTouchPos(e);
  
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
  
  [lastX, lastY] = [pos.x, pos.y];
}

function handleTouchStart(e) {
  if (e.cancelable) {
    e.preventDefault();
  }
  startDrawing(e);
}

function handleTouchMove(e) {
  if (e.cancelable) {
    e.preventDefault();
  }
  draw(e);
}

function stopDrawing() {
  isDrawing = false;
}

function clearSignature() {
  clearCanvas();
}

function isSignatureEmpty() {
  const blankCanvas = document.createElement('canvas');
  blankCanvas.width = canvas.width;
  blankCanvas.height = canvas.height;
  const blankCtx = blankCanvas.getContext('2d');
  
  blankCtx.fillStyle = '#ffffff';
  blankCtx.fillRect(0, 0, blankCanvas.width, blankCanvas.height);
  
  blankCtx.fillStyle = '#ffcdd2';
  blankCtx.font = 'italic 14px Arial';
  blankCtx.textAlign = 'center';
  blankCtx.textBaseline = 'middle';
  blankCtx.fillText('Assine aqui', blankCanvas.width / 2, blankCanvas.height / 2);
  
  const currentData = canvas.toDataURL('image/jpeg', 0.3);
  const blankData = blankCanvas.toDataURL('image/jpeg', 0.3);
  
  return currentData === blankData;
}

function getSignatureDataURL() {
  return canvas.toDataURL('image/jpeg', 0.3);
}

// ===== FUNÇÕES DO MODAL =====
function preencherModalConfirmacao() {
  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }) + ' às ' + agora.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  document.getElementById('confirmDataHora').textContent = dataFormatada;
  document.getElementById('confirmCAD').textContent = document.getElementById('cad').value;
  document.getElementById('confirmGestor').textContent = document.getElementById('gestor').value || "Não informado";
  document.getElementById('confirmColaborador').textContent = document.getElementById('colaborador').value || "Não selecionado";
  document.getElementById('confirmTipo').textContent = document.getElementById('tipo').value || "Não selecionado";
  document.getElementById('confirmEndereco').textContent = document.getElementById('endereco').value || "Não informado";
  document.getElementById('confirmEnderecoTratado').textContent = document.getElementById('enderecoTratado').value || "Não selecionado";
  document.getElementById('confirmNota').textContent = document.getElementById('nota').value + '/10';
  
  // Limitar mensagem se for muito longa
  const mensagem = document.getElementById('mensagem').value;
  document.getElementById('confirmMensagem').textContent = mensagem || "Não informada";
  
  // Assinatura
  const signatureData = getSignatureDataURL();
  const signatureImg = document.getElementById('confirmAssinatura');
  const noSignatureText = document.getElementById('noSignatureText');
  
  if (!isSignatureEmpty()) {
    signatureImg.src = signatureData;
    signatureImg.style.display = 'block';
    noSignatureText.style.display = 'none';
  } else {
    signatureImg.style.display = 'none';
    noSignatureText.style.display = 'block';
    noSignatureText.textContent = "Assinatura pendente";
    noSignatureText.style.color = "#e53935";
    noSignatureText.style.fontWeight = "600";
  }
}

function mostrarModal() {
  document.getElementById('confirmationModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function esconderModal() {
  document.getElementById('confirmationModal').style.display = 'none';
  document.body.style.overflow = 'auto';
}

// ===== FUNÇÃO PARA CARREGAR COLABORADORES =====
function carregarColaboradores() {
  const select = document.getElementById('colaborador');
  select.innerHTML = '<option value="">Carregando lista de colaboradores...</option>';
  select.disabled = true;
  
  fetch(SCRIPT_URL + "?getLista=true")
    .then(response => response.json())
    .then(lista => {
      select.innerHTML = '<option value="">Selecione o colaborador...</option>';
      if (lista.length === 0) {
        select.innerHTML = '<option value="">Nenhum colaborador encontrado</option>';
        return;
      }
      lista.forEach(item => {
        let opt = document.createElement('option');
        let textoCompleto = item.matricula + " - " + item.nome;
        opt.value = textoCompleto;
        opt.text = textoCompleto;
        select.appendChild(opt);
      });
      select.disabled = false;
      select.style.background = "white";
      select.style.borderColor = "#e0e0e0";
    })
    .catch(err => {
      console.error("Erro ao carregar lista:", err);
      select.innerHTML = '<option value="">Erro ao carregar. Verifique a conexão.</option>';
    });
}

// ===== LÓGICA PRINCIPAL DE ENVIO COM MODAL =====
document.getElementById('feedbackForm').addEventListener('submit', function(e) {
  e.preventDefault();
  
  if (enviando) return;
  
  if (!usuarioLogado) {
    mostrarErroSessao();
    return;
  }
  
  if (isSignatureEmpty()) {
    mostrarErroAssinatura();
    return;
  }
  
  preencherModalConfirmacao();
  mostrarModal();
});

// ===== EVENTOS DO MODAL =====
document.getElementById('btnCancelar').addEventListener('click', function() {
  esconderModal();
  setTimeout(() => {
    document.getElementById('cad').focus();
  }, 300);
});

document.getElementById('btnConfirmar').addEventListener('click', async function() {
  // Verificar novamente a assinatura
  if (isSignatureEmpty()) {
    Swal.fire({
      icon: 'warning',
      title: 'Assinatura Pendente',
      text: 'Por favor, solicite ao colaborador que assine antes de enviar.',
      confirmButtonColor: '#ff6f00'
    });
    esconderModal();
    return;
  }
  
  esconderModal();
  await enviarFeedback();
});

// ===== FUNÇÃO DE ENVIO REAL =====
async function enviarFeedback() {
  if (enviando || !usuarioLogado || isSignatureEmpty()) return;
  
  enviando = true;
  iniciarEnvio();
  
  try {
    const formData = {
      cad: document.getElementById('cad').value,
      gestor: document.getElementById('gestor').value,
      colaborador: document.getElementById('colaborador').value,
      tipo: document.getElementById('tipo').value,
      endereco: document.getElementById('endereco').value,
      enderecoTratado: document.getElementById('enderecoTratado').value,
      nota: document.getElementById('nota').value,
      mensagem: document.getElementById('mensagem').value,
      assinatura: getSignatureDataURL(),
      usuario: usuarioLogado.email
    };
    
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(formData)
    });
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.result === "success") {
      sucessoEnvio();
    } else {
      throw new Error(data.error || "Erro desconhecido");
    }
  } catch (error) {
    erroEnvio(error);
  } finally {
    enviando = false;
  }
}

// ===== FUNÇÕES AUXILIARES DO ENVIO =====
function iniciarEnvio() {
  const btn = document.getElementById('btnEnviar');
  const loader = document.getElementById('loader');
  
  btn.disabled = true;
  if (loader) loader.style.display = "block";
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
}

function finalizarEnvio() {
  const btn = document.getElementById('btnEnviar');
  const loader = document.getElementById('loader');
  
  if (loader) loader.style.display = "none";
  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-paper-plane"></i> Registrar';
}

function sucessoEnvio() {
  const btn = document.getElementById('btnEnviar');
  
  btn.innerHTML = '<i class="fas fa-check"></i> Enviado com Sucesso!';
  btn.style.background = 'linear-gradient(135deg, #4caf50, #66bb6a)';
  
  Swal.fire({
    icon: 'success',
    title: 'Feedback Registrado!',
    text: 'O feedback foi salvo no sistema com sucesso.',
    confirmButtonColor: '#4caf50',
    confirmButtonText: 'OK'
  });
  
  setTimeout(() => {
    limparFormulario();
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Registrar';
    btn.style.background = '';
    finalizarEnvio();
  }, 2000);
}

function erroEnvio(error) {
  console.error('Erro ao enviar:', error);
  
  Swal.fire({
    icon: 'error',
    title: 'Erro ao Enviar',
    html: `<div style="text-align: left;">
            <p>${error.message || 'Ocorreu um erro ao enviar o feedback.'}</p>
            <p style="font-size: 12px; color: #666; margin-top: 10px;">
              <i class="fas fa-lightbulb"></i> Dica: Verifique sua conexão e tente novamente.
            </p>
          </div>`,
    confirmButtonColor: '#e53935',
    confirmButtonText: 'Entendi'
  });
  
  finalizarEnvio();
}

function limparFormulario() {
  document.getElementById('feedbackForm').reset();
  clearSignature();
  updateNotaDisplay(5);
  document.getElementById('colaborador').disabled = false;
}

function mostrarErroSessao() {
  Swal.fire({
    icon: 'error',
    title: 'Sessão Expirada',
    text: 'Faça login novamente.',
    confirmButtonColor: '#e53935'
  });
  sessionStorage.removeItem('feedback_usuario');
  location.reload();
}

function mostrarErroAssinatura() {
  const signatureContainer = document.querySelector('.signature-container');
  signatureContainer.style.borderColor = '#e53935';
  signatureContainer.style.background = 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)';
  signatureContainer.style.animation = 'shake 0.5s';
  
  setTimeout(() => {
    signatureContainer.style.borderColor = '';
    signatureContainer.style.background = '';
    signatureContainer.style.animation = '';
  }, 2000);
  
  Swal.fire({
    icon: 'warning',
    title: 'Assinatura Requerida',
    text: 'Por favor, solicite ao colaborador que assine antes de enviar.',
    confirmButtonColor: '#ff6f00'
  });
}

// ===== FUNÇÃO PARA ALTERNAR VISUALIZAÇÃO =====
function alternarVisualizacao() {
  const toggleBtn = document.getElementById('toggleViewBtn');
  const isMobile = window.innerWidth < 768;
  
  if (isMobile) {
    // Em mobile, alterna entre mostrar/ocultar descrição
    document.querySelectorAll('.feedback-card').forEach(card => {
      const messagePreview = card.querySelector('.message-preview');
      if (messagePreview) {
        messagePreview.style.display = messagePreview.style.display === 'none' ? '-webkit-box' : 'none';
      }
    });
    
    toggleBtn.innerHTML = `<i class="fas fa-${messagePreview.style.display === 'none' ? 'eye' : 'eye-slash'}"></i> ${messagePreview.style.display === 'none' ? 'Ver' : 'Ocultar'} Detalhes`;
  } else {
    // Em desktop, alterna entre cards e tabela
    visualizacaoAtual = visualizacaoAtual === 'cards' ? 'tabela' : 'cards';
    
    if (visualizacaoAtual === 'cards') {
      document.querySelector('.feedbacks-table-container').style.display = 'none';
      document.getElementById('feedbacksCards').style.display = 'flex';
      toggleBtn.innerHTML = '<i class="fas fa-table"></i> Tabela';
    } else {
      document.querySelector('.feedbacks-table-container').style.display = 'block';
      document.getElementById('feedbacksCards').style.display = 'none';
      toggleBtn.innerHTML = '<i class="fas fa-th-list"></i> Cards';
    }
  }
}

// ===== FUNÇÕES PARA MEUS FEEDBACKS =====
async function carregarMeusFeedbacks() {
  if (!usuarioLogado) {
    Swal.fire({
      icon: 'error',
      title: 'Acesso Restrito',
      text: 'Você precisa estar logado para ver seus feedbacks.',
      confirmButtonColor: '#e53935'
    });
    return;
  }
  
  const feedbacksCards = document.getElementById('feedbacksCards');
  const feedbacksTableBody = document.getElementById('feedbacksTableBody');
  
  feedbacksCards.innerHTML = `
    <div style="text-align: center; padding: 30px;">
      <div class="loader" style="display: block;">
        <i class="fas fa-circle-notch"></i>
        Carregando seus feedbacks...
      </div>
    </div>
  `;
  
  feedbacksTableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 30px;">
        <div class="loader" style="display: block;">
          <i class="fas fa-circle-notch"></i>
          Carregando seus feedbacks...
        </div>
      </td>
    </tr>
  `;
  
  try {
    const response = await fetch(SCRIPT_URL + "?getMeusFeedbacks=" + encodeURIComponent(usuarioLogado.email));
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.result === "success" && data.feedbacks && data.feedbacks.length > 0) {
      meusFeedbacks = data.feedbacks;
      renderizarFeedbacksMobile();
      renderizarFeedbacksDesktop();
    } else {
      mostrarFeedbacksVazios();
    }
  } catch (error) {
    console.error('Erro ao carregar feedbacks:', error);
    mostrarErroFeedbacks(error);
  }
}

function renderizarFeedbacksMobile() {
  const startIndex = (currentFeedbacksPage - 1) * feedbacksPerPage;
  const endIndex = Math.min(startIndex + feedbacksPerPage, meusFeedbacks.length);
  const pageFeedbacks = meusFeedbacks.slice(startIndex, endIndex);
  const totalPages = Math.ceil(meusFeedbacks.length / feedbacksPerPage);
  
  let feedbacksHTML = '';
  
  pageFeedbacks.forEach((feedback, index) => {
    const globalIndex = startIndex + index;
    const dataFormatada = new Date(feedback.data).toLocaleDateString('pt-BR');
    const horaFormatada = new Date(feedback.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Extrair apenas o nome do colaborador (remover matrícula)
    let colaboradorNome = feedback.colaborador;
    if (feedback.colaborador && feedback.colaborador.includes('-')) {
      const parts = feedback.colaborador.split('-');
      if (parts.length > 1) {
        colaboradorNome = parts.slice(1).join('-').trim();
      }
    }
    
    feedbacksHTML += `
      <div class="feedback-card">
        <div class="feedback-header">
          <div>
            <div class="feedback-date">${dataFormatada}</div>
            <div class="feedback-time">${horaFormatada}</div>
          </div>
          <div class="feedback-number">#${globalIndex + 1}</div>
        </div>
        
        <div class="feedback-info-grid">
          <div class="info-item">
            <div class="info-label">CAD</div>
            <div class="info-value">${feedback.cad || 'N/A'}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Colaborador</div>
            <div class="info-value">${colaboradorNome}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Tipo</div>
            <div>
              <span class="feedback-badge" style="background: ${getCorPorTipo(feedback.tipo)};">
                ${feedback.tipo}
              </span>
            </div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Nota</div>
            <div>
              <span class="nota-display-small" style="background: ${getCorPorNotaCSS(feedback.nota)};">
                ${feedback.nota}/10
              </span>
            </div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Endereço WMS</div>
            <div class="info-value">${feedback.endereco || 'N/A'}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Status</div>
            <div>
              <span class="status-badge" style="background: ${getCorPorStatus(feedback.status)};">
                ${feedback.status || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        
        <div class="feedback-message">
          <div class="info-label">Descrição</div>
          <div class="message-preview">
            ${feedback.mensagem || 'Sem descrição'}
          </div>
        </div>
      </div>
    `;
  });
  
  document.getElementById('feedbacksCards').innerHTML = feedbacksHTML;
  renderizarPaginacao(totalPages);
}

function renderizarFeedbacksDesktop() {
  const startIndex = (currentFeedbacksPage - 1) * feedbacksPerPage;
  const endIndex = Math.min(startIndex + feedbacksPerPage, meusFeedbacks.length);
  const pageFeedbacks = meusFeedbacks.slice(startIndex, endIndex);
  
  let tableHTML = '';
  
  pageFeedbacks.forEach((feedback) => {
    const dataFormatada = new Date(feedback.data).toLocaleDateString('pt-BR');
    const horaFormatada = new Date(feedback.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    // Extrair apenas o nome do colaborador (remover matrícula)
    let colaboradorNome = feedback.colaborador;
    if (feedback.colaborador && feedback.colaborador.includes('-')) {
      const parts = feedback.colaborador.split('-');
      if (parts.length > 1) {
        colaboradorNome = parts.slice(1).join('-').trim();
      }
    }
    
    tableHTML += `
      <tr>
        <td>
          <div style="font-weight: 500;">${dataFormatada}</div>
          <div style="font-size: 12px; color: var(--text-light);">${horaFormatada}</div>
        </td>
        <td>${feedback.cad || 'N/A'}</td>
        <td>${colaboradorNome}</td>
        <td>
          <span class="feedback-badge" style="background: ${getCorPorTipo(feedback.tipo)};">
            ${feedback.tipo}
          </span>
        </td>
        <td>
          <span class="nota-display-small" style="background: ${getCorPorNotaCSS(feedback.nota)};">
            ${feedback.nota}/10
          </span>
        </td>
        <td>${feedback.endereco || 'N/A'}</td>
        <td>
          <span class="status-badge" style="background: ${getCorPorStatus(feedback.status)};">
            ${feedback.status || 'N/A'}
          </span>
        </td>
      </tr>
    `;
  });
  
  document.getElementById('feedbacksTableBody').innerHTML = tableHTML;
}

function mostrarFeedbacksVazios() {
  const feedbacksCards = document.getElementById('feedbacksCards');
  const feedbacksTableBody = document.getElementById('feedbacksTableBody');
  
  feedbacksCards.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--text-light);">
      <i class="fas fa-inbox" style="font-size: 40px; margin-bottom: 15px; color: #e0e0e0;"></i>
      <h4 style="margin-bottom: 10px; color: var(--text-light);">Nenhum feedback encontrado</h4>
      <p style="font-size: 14px; margin-bottom: 20px;">Você ainda não registrou nenhum feedback no sistema.</p>
      <button class="btn-submit" onclick="document.querySelector('[data-page=\\'feedback\\']').click()" style="max-width: 250px; margin: 0 auto;">
        <i class="fas fa-plus-circle"></i>
        Registrar Primeiro Feedback
      </button>
    </div>
  `;
  
  feedbacksTableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-light);">
        <i class="fas fa-inbox" style="font-size: 40px; margin-bottom: 15px; color: #e0e0e0; display: block;"></i>
        <h4 style="margin-bottom: 10px; color: var(--text-light);">Nenhum feedback encontrado</h4>
        <p style="font-size: 14px;">Você ainda não registrou nenhum feedback no sistema.</p>
      </td>
    </tr>
  `;
  
  document.getElementById('paginationControls').style.display = 'none';
}

function mostrarErroFeedbacks(error) {
  const feedbacksCards = document.getElementById('feedbacksCards');
  const feedbacksTableBody = document.getElementById('feedbacksTableBody');
  
  feedbacksCards.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: var(--shoppe-red);">
      <i class="fas fa-exclamation-triangle" style="font-size: 40px; margin-bottom: 15px;"></i>
      <h4 style="margin-bottom: 10px; color: var(--shoppe-red);">Erro ao carregar feedbacks</h4>
      <p style="font-size: 14px; margin-bottom: 20px;">${error.message || 'Não foi possível carregar seus feedbacks.'}</p>
      <button class="btn-submit" onclick="carregarMeusFeedbacks()" style="max-width: 200px; margin: 0 auto;">
        <i class="fas fa-redo"></i>
        Tentar Novamente
      </button>
    </div>
  `;
  
  feedbacksTableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; padding: 40px; color: var(--shoppe-red);">
        <i class="fas fa-exclamation-triangle" style="font-size: 40px; margin-bottom: 15px; display: block;"></i>
        <h4 style="margin-bottom: 10px; color: var(--shoppe-red);">Erro ao carregar feedbacks</h4>
        <p style="font-size: 14px;">${error.message || 'Não foi possível carregar seus feedbacks.'}</p>
      </td>
    </tr>
  `;
  
  document.getElementById('paginationControls').style.display = 'none';
}

function renderizarPaginacao(totalPages) {
  const paginationControls = document.getElementById('paginationControls');
  
  if (totalPages <= 1) {
    paginationControls.style.display = 'none';
    return;
  }
  
  let paginationHTML = `
    <div class="pagination-info">
      Mostrando ${(currentFeedbacksPage - 1) * feedbacksPerPage + 1} - ${Math.min(currentFeedbacksPage * feedbacksPerPage, meusFeedbacks.length)} de ${meusFeedbacks.length} feedbacks
    </div>
    
    <div class="pagination-controls">
      <div class="items-per-page">
        <span>Itens por página:</span>
        <select id="itemsPerPageSelect" onchange="mudarItensPorPagina(this.value)">
          <option value="5" ${feedbacksPerPage === 5 ? 'selected' : ''}>5</option>
          <option value="10" ${feedbacksPerPage === 10 ? 'selected' : ''}>10</option>
          <option value="15" ${feedbacksPerPage === 15 ? 'selected' : ''}>15</option>
          <option value="20" ${feedbacksPerPage === 20 ? 'selected' : ''}>20</option>
          <option value="25" ${feedbacksPerPage === 25 ? 'selected' : ''}>25</option>
        </select>
      </div>
      
      <div class="pagination-buttons">
        <button class="pagination-button" onclick="mudarPagina(1)" ${currentFeedbacksPage === 1 ? 'disabled' : ''}>
          <i class="fas fa-angle-double-left"></i>
        </button>
        <button class="pagination-button" onclick="mudarPagina(${currentFeedbacksPage - 1})" ${currentFeedbacksPage === 1 ? 'disabled' : ''}>
          <i class="fas fa-angle-left"></i>
        </button>
        
        <div class="page-numbers">
  `;
  
  // Gerar números de página
  const maxVisiblePages = window.innerWidth < 480 ? 3 : 5;
  let startPage = Math.max(1, currentFeedbacksPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  if (startPage > 1) {
    paginationHTML += `<span class="page-number" onclick="mudarPagina(1)">1</span>`;
    if (startPage > 2) {
      paginationHTML += `<span class="page-ellipsis">...</span>`;
    }
  }
  
  for (let i = startPage; i <= endPage; i++) {
    paginationHTML += `<span class="page-number ${i === currentFeedbacksPage ? 'active' : ''}" onclick="mudarPagina(${i})">${i}</span>`;
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      paginationHTML += `<span class="page-ellipsis">...</span>`;
    }
    paginationHTML += `<span class="page-number" onclick="mudarPagina(${totalPages})">${totalPages}</span>`;
  }
  
  paginationHTML += `
        </div>
        
        <button class="pagination-button" onclick="mudarPagina(${currentFeedbacksPage + 1})" ${currentFeedbacksPage === totalPages ? 'disabled' : ''}>
          <i class="fas fa-angle-right"></i>
        </button>
        <button class="pagination-button" onclick="mudarPagina(${totalPages})" ${currentFeedbacksPage === totalPages ? 'disabled' : ''}>
          <i class="fas fa-angle-double-right"></i>
        </button>
      </div>
    </div>
  `;
  
  paginationControls.innerHTML = paginationHTML;
  paginationControls.style.display = 'flex';
}

function mudarPagina(pagina) {
  if (pagina >= 1 && pagina <= Math.ceil(meusFeedbacks.length / feedbacksPerPage)) {
    currentFeedbacksPage = pagina;
    renderizarFeedbacksMobile();
    renderizarFeedbacksDesktop();
    // Scroll para o topo
    document.querySelector('.feedbacks-container').scrollIntoView({ behavior: 'smooth' });
  }
}

function mudarItensPorPagina(valor) {
  feedbacksPerPage = parseInt(valor);
  currentFeedbacksPage = 1;
  renderizarFeedbacksMobile();
  renderizarFeedbacksDesktop();
}

// ===== FUNÇÕES PARA RELATÓRIOS =====
async function gerarRelatorios() {
  if (!usuarioLogado) return;
  
  const chartsGrid = document.getElementById('chartsGrid');
  chartsGrid.innerHTML = `
    <div style="text-align: center; padding: 30px; grid-column: 1 / -1;">
      <div class="loader" style="display: block;">
        <i class="fas fa-circle-notch"></i>
        Gerando relatórios e gráficos...
      </div>
    </div>
  `;
  
  try {
    const response = await fetch(SCRIPT_URL + "?getMeusFeedbacks=" + encodeURIComponent(usuarioLogado.email));
    
    if (!response.ok) {
      throw new Error(`Erro ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.result === "success" && data.feedbacks && data.feedbacks.length > 0) {
      meusFeedbacks = data.feedbacks;
      atualizarEstatisticas();
      renderizarGraficos();
    } else {
      chartsGrid.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--text-light); grid-column: 1 / -1;">
          <i class="fas fa-chart-bar" style="font-size: 40px; margin-bottom: 15px; color: #e0e0e0;"></i>
          <h4 style="margin-bottom: 10px; color: var(--text-light);">Dados insuficientes para relatórios</h4>
          <p style="font-size: 14px; margin-bottom: 20px;">Registre alguns feedbacks para gerar estatísticas e gráficos</p>
          <button class="btn-submit" onclick="document.querySelector('[data-page=\\'feedback\\']').click()" style="max-width: 200px; margin: 0 auto;">
            <i class="fas fa-plus-circle"></i>
            Registrar Feedback
          </button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Erro ao carregar relatórios:', error);
    chartsGrid.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--shoppe-red); grid-column: 1 / -1;">
        <i class="fas fa-exclamation-triangle" style="font-size: 40px; margin-bottom: 15px;"></i>
        <h4 style="margin-bottom: 10px; color: var(--shoppe-red);">Erro ao carregar relatórios</h4>
        <p style="font-size: 14px; margin-bottom: 20px;">${error.message || 'Não foi possível carregar os dados para relatórios.'}</p>
        <button class="btn-submit" onclick="gerarRelatorios()" style="max-width: 200px; margin: 0 auto;">
          <i class="fas fa-redo"></i>
          Tentar Novamente
        </button>
      </div>
    `;
  }
}

function atualizarEstatisticas() {
  if (!meusFeedbacks || meusFeedbacks.length === 0) return;
  
  // Total de feedbacks
  document.getElementById('totalFeedbacks').textContent = meusFeedbacks.length;
  
  // Nota média
  const totalNota = meusFeedbacks.reduce((sum, f) => sum + parseFloat(f.nota || 0), 0);
  const avgNota = (totalNota / meusFeedbacks.length).toFixed(1);
  document.getElementById('avgNota').textContent = avgNota;
  
  // Tipo mais comum
  const tipoCounts = {};
  meusFeedbacks.forEach(f => {
    tipoCounts[f.tipo] = (tipoCounts[f.tipo] || 0) + 1;
  });
  let topTipo = '';
  let maxCount = 0;
  Object.entries(tipoCounts).forEach(([tipo, count]) => {
    if (count > maxCount) {
      maxCount = count;
      topTipo = tipo;
    }
  });
  document.getElementById('topTipo').textContent = topTipo.substring(0, 12) + (topTipo.length > 12 ? '...' : '');
  
  // Taxa de conclusão (endereços tratados)
  const concluidos = meusFeedbacks.filter(f => f.status === 'Concluido' || f.status === 'Concluído').length;
  const completionRate = Math.round((concluidos / meusFeedbacks.length) * 100);
  document.getElementById('completionRate').textContent = `${completionRate}%`;
}

function renderizarGraficos() {
  const chartsGrid = document.getElementById('chartsGrid');
  
  // Limpar gráficos existentes
  chartsGrid.innerHTML = '';
  
  // Dados para gráficos
  const tipoCounts = {};
  const notaCounts = {};
  const statusCounts = {};
  const notasPorMes = {};
  
  meusFeedbacks.forEach(feedback => {
    // Contagem por tipo
    tipoCounts[feedback.tipo] = (tipoCounts[feedback.tipo] || 0) + 1;
    
    // Contagem por nota
    const nota = parseInt(feedback.nota);
    notaCounts[nota] = (notaCounts[nota] || 0) + 1;
    
    // Contagem por status
    const status = feedback.status || 'Não informado';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    
    // Notas por mês
    const data = new Date(feedback.data);
    const mesAno = `${data.getMonth() + 1}/${data.getFullYear()}`;
    if (!notasPorMes[mesAno]) {
      notasPorMes[mesAno] = { total: 0, count: 0 };
    }
    notasPorMes[mesAno].total += nota;
    notasPorMes[mesAno].count += 1;
  });
  
  // Paleta extra de cores para evitar duplicatas (30 cores distintas)
  const paletaExtra = [
    '#3366cc', '#dc3912', '#ff9900', '#109618', '#990099', '#0099c6', 
    '#dd4477', '#66aa00', '#b82e2e', '#316395', '#994499', '#22aa99', 
    '#aaaa11', '#6633cc', '#e67300', '#8b0707', '#651067', '#329262', 
    '#5574a6', '#3b3eac', '#b77322', '#16d620', '#b91383', '#f4359e', 
    '#9c5935', '#a9c413', '#2a778d', '#668d1c', '#bea413', '#0c5922'
  ];

  // Gráfico 1: Distribuição por Tipo de Feedback
  const tiposLabels = Object.keys(tipoCounts);
  const tiposData = Object.values(tipoCounts);
  
  // Gera as cores
  const tiposCores = tiposLabels.map((tipo, index) => {
      const corPadrao = getCorPorTipo(tipo);
      if (corPadrao === '#757575') {
          return paletaExtra[index % paletaExtra.length];
      }
      return corPadrao;
  });
  
  chartsGrid.innerHTML += `
    <div class="chart-container">
      <div class="chart-header">
        <h4><i class="fas fa-chart-pie"></i> Tipo de Feedback</h4>
      </div>
      <div class="chart-wrapper">
        <canvas id="chartTipos"></canvas>
      </div>
    </div>
  `;
  
  // Gráfico 2: Distribuição por Nota
  const notasLabels = Object.keys(notaCounts).sort((a, b) => a - b);
  const notasData = notasLabels.map(nota => notaCounts[nota]);
  const notasCores = notasLabels.map(nota => getCorPorNotaCSS(parseInt(nota)));
  
  chartsGrid.innerHTML += `
    <div class="chart-container">
      <div class="chart-header">
        <h4><i class="fas fa-star"></i> Distribuição por Nota</h4>
      </div>
      <div class="chart-wrapper">
        <canvas id="chartNotas"></canvas>
      </div>
    </div>
  `;
  
  // Gráfico 3: Status dos Endereços
  const statusLabels = Object.keys(statusCounts);
  const statusData = Object.values(statusCounts);
  const statusCores = statusLabels.map(status => getCorPorStatus(status));
  
  chartsGrid.innerHTML += `
    <div class="chart-container">
      <div class="chart-header">
        <h4><i class="fas fa-check-circle"></i> Endereço Tratado ?</h4>
      </div>
      <div class="chart-wrapper">
        <canvas id="chartStatus"></canvas>
      </div>
    </div>
  `;
  
  // Gráfico 4: Evolução da Nota Média por Mês
  const mesesLabels = Object.keys(notasPorMes).sort((a, b) => {
    const [mesA, anoA] = a.split('/').map(Number);
    const [mesB, anoB] = b.split('/').map(Number);
    return new Date(anoA, mesA - 1) - new Date(anoB, mesB - 1);
  });
  const notasMedias = mesesLabels.map(mes => 
    (notasPorMes[mes].total / notasPorMes[mes].count).toFixed(1)
  );
  
  chartsGrid.innerHTML += `
    <div class="chart-container" style="grid-column: 1 / -1;">
      <div class="chart-header">
        <h4><i class="fas fa-chart-line"></i> Evolução da Nota Média</h4>
      </div>
      <div class="chart-wrapper">
        <canvas id="chartEvolucao"></canvas>
      </div>
    </div>
  `;
  
  // Renderizar gráficos após o DOM ser atualizado
  setTimeout(() => {
    // Gráfico de pizza - Tipos
    new Chart(document.getElementById('chartTipos'), {
      type: 'pie',
      data: {
        labels: tiposLabels,
        datasets: [{
          data: tiposData,
          backgroundColor: tiposCores,
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: window.innerWidth < 768 ? 'bottom' : 'right',
            labels: {
              padding: 15,
              usePointStyle: true,
              font: {
                size: window.innerWidth < 768 ? 10 : 11
              }
            }
          }
        }
      }
    });
    
    // Gráfico de barras - Notas
    new Chart(document.getElementById('chartNotas'), {
      type: 'bar',
      data: {
        labels: notasLabels.map(n => `${n}/10`),
        datasets: [{
          label: 'Quantidade',
          data: notasData,
          backgroundColor: notasCores,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
    
    // Gráfico de doughnut - Status
    new Chart(document.getElementById('chartStatus'), {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [{
          data: statusData,
          backgroundColor: statusCores,
          borderWidth: 1,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '50%',
        plugins: {
          legend: {
            position: window.innerWidth < 768 ? 'bottom' : 'right',
            labels: {
              padding: 10,
              usePointStyle: true,
              font: {
                size: window.innerWidth < 768 ? 10 : 11
              }
            }
          }
        }
      }
    });
    
    // Gráfico de linha - Evolução
    new Chart(document.getElementById('chartEvolucao'), {
      type: 'line',
      data: {
        labels: mesesLabels,
        datasets: [{
          label: 'Nota Média',
          data: notasMedias,
          borderColor: '#e53935',
          backgroundColor: 'rgba(229, 57, 53, 0.1)',
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#e53935',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: false,
            min: 0,
            max: 10,
            ticks: {
              stepSize: 1
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  }, 100);
}

// ===== FUNÇÕES AUXILIARES PARA CORES =====
function getCorPorTipo(tipo) {
  const cores = {
    'Qualidade Putaway': '#9c27b0',
    'Sugestão de Melhoria': '#009688',
    'Limite de SKU\'s': '#2196f3',
    'Sobra': '#ff9800',
    'Falta': '#f44336',
    'Embalagens': '#795548',
    'OB Verdadeiro - PNE': '#4caf50',
    'OB Verdadeiro - PE': '#4caf50',
    'OB Falso': '#757575'
  };
  return cores[tipo] || '#757575';
}

function getCorPorNotaCSS(nota) {
  if (nota <= 3) return '#e53935';
  if (nota <= 5) return '#ff6f00';
  if (nota <= 7) return '#ff9800';
  if (nota <= 9) return '#ffab00';
  return '#ffc400';
}

function getCorPorStatus(status) {
  if (status === 'Concluido' || status === 'Concluído') return '#4caf50';
  if (status === 'Pendente') return '#ff6f00';
  if (status === 'NA') return '#757575';
  return '#9e9e9e';
}

// ===== FUNÇÃO PARA EXPORTAR PDF =====
async function exportarFeedbacksPDF() {
  if (!meusFeedbacks || meusFeedbacks.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Nada para Exportar',
      text: 'Não há feedbacks para exportar. Carregue seus feedbacks primeiro.',
      confirmButtonColor: '#2196f3'
    });
    return;
  }
  
  // Perguntar ao usuário o que exportar
  const { value: exportType } = await Swal.fire({
    title: 'Exportar Feedbacks',
    text: 'Exportar página atual ou todos os feedbacks?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Exportar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#2196f3',
    cancelButtonColor: '#6c757d',
    input: 'radio',
    inputOptions: {
      'current': 'Página atual',
      'all': 'Todos os feedbacks'
    },
    inputValue: 'current',
    inputValidator: (value) => {
      if (!value) {
        return 'Você precisa escolher uma opção!';
      }
    }
  });
  
  if (!exportType) return;
  
  const loadingSwal = Swal.fire({
    title: 'Gerando PDF...',
    html: '<div class="loader" style="margin: 20px 0;"><i class="fas fa-circle-notch fa-spin"></i> Preparando documento...</div>',
    showConfirmButton: false,
    allowOutsideClick: false
  });
  
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);
    
    // Determinar quais feedbacks exportar
    let feedbacksToExport;
    let exportInfo;
    let startIndex;
    let endIndex;
    
    if (exportType === 'current') {
      // Pega apenas os feedbacks da página atual
      startIndex = (currentFeedbacksPage - 1) * feedbacksPerPage;
      endIndex = Math.min(startIndex + feedbacksPerPage, meusFeedbacks.length);
      feedbacksToExport = meusFeedbacks.slice(startIndex, endIndex);
      exportInfo = `Página ${currentFeedbacksPage} (${feedbacksToExport.length} feedbacks)`;
    } else {
      // Pega todos os feedbacks
      feedbacksToExport = meusFeedbacks;
      exportInfo = `Todos os feedbacks (${feedbacksToExport.length} no total)`;
    }
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(229, 57, 53);
    doc.text('RELATÓRIO DE FEEDBACKS', pageWidth / 2, margin, { align: 'center' });
    
    // Informações
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, margin + 8);
    doc.text(`Usuário: ${usuarioLogado.nome}`, margin, margin + 13);
    doc.text(`${exportInfo}`, pageWidth - margin, margin + 8, { align: 'right' });
    
    // Adicionar informações específicas se for página atual
    if (exportType === 'current') {
      doc.text(`Posição: ${startIndex + 1} a ${endIndex} de ${meusFeedbacks.length}`, pageWidth - margin, margin + 13, { align: 'right' });
    }
    
    // Linha divisória
    doc.setDrawColor(229, 57, 53);
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 18, pageWidth - margin, margin + 18);
    
    let yPosition = margin + 25;
    
    // Verificar se há feedbacks para exportar
    if (feedbacksToExport.length === 0) {
      loadingSwal.close();
      Swal.fire({
        icon: 'warning',
        title: 'Nenhum Feedback',
        text: 'Não há feedbacks para exportar na seleção escolhida.',
        confirmButtonColor: '#ff6f00'
      });
      return;
    }
    
    // Adicionar cada feedback
    feedbacksToExport.forEach((feedback, index) => {
      if (yPosition > doc.internal.pageSize.height - 30) {
        doc.addPage();
        yPosition = margin;
      }
      
      const dataFormatada = new Date(feedback.data).toLocaleDateString('pt-BR');
      const horaFormatada = new Date(feedback.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      
      // Determinar número do feedback
      let feedbackNumber;
      if (exportType === 'current') {
        feedbackNumber = startIndex + index + 1;
      } else {
        feedbackNumber = index + 1;
      }
      
      // Título do feedback
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 33, 33);
      doc.text(`Feedback #${feedbackNumber}`, margin, yPosition);
      
      // Data e hora
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`${dataFormatada} ${horaFormatada}`, pageWidth - margin, yPosition, { align: 'right' });
      
      yPosition += 7;
      
      // Informações
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('CAD:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(feedback.cad || 'N/A', margin + 15, yPosition);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Tipo:', margin + contentWidth / 2, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(feedback.tipo, margin + contentWidth / 2 + 12, yPosition);
      
      yPosition += 6;
      
      // Colaborador
      let colaboradorNome = feedback.colaborador;
      if (feedback.colaborador && feedback.colaborador.includes('-')) {
        const parts = feedback.colaborador.split('-');
        if (parts.length > 1) {
          colaboradorNome = parts.slice(1).join('-').trim();
        }
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Colaborador:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      const colaboradorTexto = doc.splitTextToSize(colaboradorNome, contentWidth / 2);
      doc.text(colaboradorTexto, margin + 25, yPosition);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Endereço WMS:', margin + contentWidth / 2, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(feedback.endereco || 'N/A', margin + contentWidth / 2 + 28, yPosition);
      
      yPosition += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', margin, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(feedback.status || 'N/A', margin + 15, yPosition);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Nota:', margin + contentWidth / 2, yPosition);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 57, 53);
      doc.text(`${feedback.nota}/10`, margin + contentWidth / 2 + 15, yPosition);
      
      yPosition += 6;
      
      // Descrição (limitada)
      let descricao = feedback.mensagem || 'Sem descrição';
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      
      const descricaoLines = doc.splitTextToSize(descricao, contentWidth - 10);
      doc.text(descricaoLines, margin + 5, yPosition);
      
      yPosition += descricaoLines.length * 4 + 10;
      
      // Linha separadora
      doc.setDrawColor(224, 224, 224);
      doc.setLineWidth(0.2);
      doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);
    });
    
    // Adicionar estatísticas se tiver espaço
    if (yPosition < doc.internal.pageSize.height - 40) {
      yPosition += 10;
      
      // Linha divisória para estatísticas
      doc.setDrawColor(229, 57, 53);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      // Estatísticas
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(33, 33, 33);
      doc.text('ESTATÍSTICAS', margin, yPosition);
      
      yPosition += 7;
      
      // Calcular estatísticas
      const notas = feedbacksToExport.map(f => parseInt(f.nota));
      const media = notas.reduce((a, b) => a + b, 0) / notas.length;
      const maxNota = Math.max(...notas);
      const minNota = Math.min(...notas);
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Média de notas: ${media.toFixed(1)}/10`, margin, yPosition);
      doc.text(`• Nota mais alta: ${maxNota}/10`, margin + contentWidth / 2, yPosition);
      yPosition += 5;
      
      doc.text(`• Nota mais baixa: ${minNota}/10`, margin, yPosition);
      doc.text(`• Feedbacks exportados: ${feedbacksToExport.length}`, margin + contentWidth / 2, yPosition);
    }
    
    // Rodapé
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    loadingSwal.close();
    
    // Nome do arquivo
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    let fileName;
    
    if (exportType === 'current') {
      fileName = `feedbacks_pagina_${currentFeedbacksPage}_${usuarioLogado.nome.replace(/\s+/g, '_')}_${dateStr}.pdf`;
    } else {
      fileName = `feedbacks_todos_${usuarioLogado.nome.replace(/\s+/g, '_')}_${dateStr}.pdf`;
    }
    
    doc.save(fileName);
    
    Swal.fire({
      icon: 'success',
      title: 'PDF Gerado!',
      html: `<div style="text-align: left; padding: 10px;">
              <p><strong>Arquivo:</strong> ${fileName}</p>
              <p><strong>Feedbacks exportados:</strong> ${feedbacksToExport.length}</p>
              <p><strong>Tipo de exportação:</strong> ${exportType === 'current' ? 'Página atual' : 'Todos os feedbacks'}</p>
              ${exportType === 'current' ? `<p><strong>Página:</strong> ${currentFeedbacksPage}</p>` : ''}
              <p style="font-size: 12px; color: #666; margin-top: 10px;">
                <i class="fas fa-info-circle"></i> O arquivo foi baixado automaticamente.
              </p>
            </div>`,
      confirmButtonColor: '#4caf50'
    });
    
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    loadingSwal.close();
    
    Swal.fire({
      icon: 'error',
      title: 'Erro ao Gerar PDF',
      text: 'Ocorreu um erro ao gerar o arquivo PDF. Tente novamente.',
      confirmButtonColor: '#e53935'
    });
  }
}

// ===== EVENTOS ADICIONAIS =====
document.addEventListener('keydown', function(e) {
  const modal = document.getElementById('confirmationModal');
  if (e.key === 'Escape') {
    if (modal.style.display === 'flex') {
      esconderModal();
    }
  }
});

document.getElementById('confirmationModal').addEventListener('click', function(e) {
  if (e.target === this) {
    esconderModal();
  }
});

// Placeholder dinâmico para gestor
document.getElementById('gestor').addEventListener('focus', function() {
  if (usuarioLogado && !this.value) {
    this.placeholder = `Ex: ${usuarioLogado.nome} (se for você)`;
  }
});

document.getElementById('gestor').addEventListener('blur', function() {
  this.placeholder = "Quem está aplicando o feedback?";
});

// Event listener para Enter no login
document.getElementById('loginEmail').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const email = this.value.trim();
    if (email) {
      processarLogin(email);
    }
  }
});