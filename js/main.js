document.addEventListener('DOMContentLoaded', function () {
    const header = document.querySelector('header');

    function handleScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    function toggleNav() {
        const nav = document.querySelector('nav');
        nav.classList.toggle('nav-open');
    }

    window.addEventListener('scroll', handleScroll);

    const hamburger = document.createElement('div');
    hamburger.classList.add('hamburger');
    hamburger.innerHTML = '<span></span><span></span><span></span>';

    const nav = header.querySelector('nav');
    header.insertBefore(hamburger, nav);

    hamburger.addEventListener('click', toggleNav);
});
