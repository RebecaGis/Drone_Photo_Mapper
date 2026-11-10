# Alterações · 10/11/2026

- Ponto de partida: `index.html` da pasta Drone Photo Mapper fornecida pela autora.
- Separação da lógica em `app.js` e `core.js`, preservando o estilo visual.
- Correção de GPS zero, validação de DMS e remoção da suposição de hemisfério S/W quando a referência não existe.
- IDs de foto como strings, compatíveis com a seleção na lista.
- Escape de nomes e endereços inseridos no HTML.
- Importação em fila; a limpeza cancela logicamente leituras pendentes para evitar que fotos reapareçam.
- Falhas de geocodificação não são salvas como endereço e podem ser consultadas novamente.
- Timeout, espaçamento das consultas, cache em sessão e seleção de provedor.
- Simulação offline funcional e atualização dos botões quando a conexão muda.
- Remoção do kit Font Awesome de exemplo e do registro inválido de service worker por Blob.
- Manifesto, ícone e service worker em arquivos reais, com cache limitado à aplicação e bibliotecas.
- README, badges, testes e manutenção dos caminhos de entrada anteriores.

Os testes automatizados usam DOM, mapa e exportador simulados. A tentativa de abrir a prévia local no navegador integrado expirou; não foi concluída validação visual, de instalação ou de Excel real. Nenhuma consulta com coordenadas de fotos reais foi enviada a serviços externos durante o desenvolvimento.
