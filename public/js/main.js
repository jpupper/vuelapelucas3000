// Vuelapelucas 3000 - JavaScript Principal
(function() {
    'use strict';

    // Smooth scroll para enlaces internos
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // Formulario de inscripción (lógica compartida con anotate.html)
    if (window.InscripcionForm) {
        window.InscripcionForm.init({ formId: 'form-inscripcion', messageId: 'form-message' });
    }

    // Navbar scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        const scrollIndicator = document.querySelector('.scroll-indicator');
        
        if (scrollIndicator) {
            if (currentScroll > 100) {
                scrollIndicator.style.opacity = '0';
            } else {
                scrollIndicator.style.opacity = '1';
            }
        }
        
        lastScroll = currentScroll;
    });

    // Intersection Observer para animaciones
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Aplicar animación a las cards
    const revealCards = document.querySelectorAll('.festival-card, .gallery-item, .place-card');
    revealCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Red de seguridad: si el observer no dispara (prerender, capturas,
    // navegadores sin IntersectionObserver), mostramos todo igual.
    const revealAll = () => revealCards.forEach(card => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    });
    if (!('IntersectionObserver' in window)) revealAll();
    setTimeout(() => {
        revealCards.forEach(card => {
            const r = card.getBoundingClientRect();
            if (r.top < (window.innerHeight || 800) * 1.5) {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }
        });
    }, 1800);

    console.log('✅ Vuelapelucas 3000 - Sistema cargado');
})();
