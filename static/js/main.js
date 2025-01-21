// Splash Screen
document.addEventListener('DOMContentLoaded', function() {
    const splashScreen = document.getElementById('splash-screen');
    
    // Fade out splash screen after 2 seconds
    setTimeout(() => {
        splashScreen.classList.add('fade-out');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 500);
    }, 2000);

    // Elements
    const promptInput = document.getElementById('prompt-input');
    const generateBtn = document.getElementById('generate-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const imageContainer = document.getElementById('image-container');
    const generatedImage = document.getElementById('generated-image');
    const errorMessage = document.getElementById('error-message');
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const navbar = document.querySelector('nav');
    const sections = document.querySelectorAll('section[id]');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const html = document.documentElement;

    // Initialize dark mode with smooth transition
    document.documentElement.classList.add('transition-colors', 'duration-300');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    }

    // Theme toggle
    themeToggleBtn?.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
    });

    // Get DOM elements
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('main-nav');

    // Sticky Navigation
    let lastScrollTop = 0;
    const scrollThreshold = 100;

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Add background when scrolled down
        if (scrollTop > scrollThreshold) {
            nav.classList.add('glass-nav');
        } else {
            nav.classList.remove('glass-nav');
        }
        
        // Hide/show navigation based on scroll direction
        if (scrollTop > lastScrollTop && scrollTop > nav.offsetHeight) {
            // Scrolling down & past nav height
            nav.classList.add('nav-hidden');
        } else {
            // Scrolling up
            nav.classList.remove('nav-hidden');
        }
        
        lastScrollTop = scrollTop;
    });

    // Mobile Menu Functionality
    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.toggle('hidden');
            mobileMenu.classList.toggle('show');
            mobileMenuBtn.classList.toggle('active');
        });

        // Close mobile menu when clicking a link
        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('show');
                mobileMenuBtn.classList.remove('active');
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (mobileMenu && !mobileMenu.classList.contains('hidden') &&
                !mobileMenu.contains(e.target) && 
                !mobileMenuBtn.contains(e.target)) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('show');
                mobileMenuBtn.classList.remove('active');
            }
        });

        // Close mobile menu when window is resized to desktop size
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768 && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                mobileMenu.classList.remove('show');
                mobileMenuBtn.classList.remove('active');
            }
        });
    }

    // Smooth scroll for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Image generation functionality
    if (generateBtn && promptInput) {
        generateBtn.addEventListener('click', generateImage);
    }

    async function generateImage() {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            showMessage('Please enter a prompt first', 'error');
            return;
        }

        try {
            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Generating...</span>';
            
            console.log('Sending request to generate image with prompt:', prompt);
            const response = await fetch('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: prompt })
            });

            console.log('Received response:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.success) {
                const resultDiv = document.getElementById('result');
                const generatedImage = document.getElementById('generated-image');
                
                console.log('Setting image URL:', data.image_url);
                generatedImage.src = data.image_url;
                generatedImage.dataset.imageId = data.image_id;
                resultDiv.classList.remove('hidden');
                
                // Update latest images if needed
                if (data.latest_images) {
                    updateLatestImages(data.latest_images);
                }
            } else {
                throw new Error(data.error || 'Failed to generate image');
            }
        } catch (error) {
            console.error('Generation error:', error);
            showMessage(error.message || 'Failed to generate image. Please try again.', 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i><span>Generate</span>';
        }
    }

    function updateLatestImages(images) {
        const grid = document.getElementById('latest-images-grid');
        if (!grid) return;

        let newImages = '';
        images.forEach(image => {
            newImages += `
                <div class="glass-card p-4 rounded-xl hover:scale-105 transition-transform duration-300">
                    <div class="image-container rounded-lg overflow-hidden mb-4">
                        <img src="${image.url}" 
                             alt="${image.prompt}" 
                             class="w-full h-full object-cover"
                             loading="lazy">
                    </div>
                    <div class="space-y-3">
                        <p class="prompt-text text-white/90 text-sm">${image.prompt}</p>
                        <div class="tag-container">
                            <span class="glass-chip text-xs px-2 py-1 text-white/80">${image.category}</span>
                            ${image.tags.slice(0, 2).map(tag => `
                                <span class="glass-chip text-xs px-2 py-1 text-white/80">${tag}</span>
                            `).join('')}
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-white/60 text-xs">${image.timestamp.split('T')[0]}</p>
                            <div class="image-actions">
                                <button class="like-button text-white/60 hover:text-pink-500 transition-colors" 
                                        onclick="likeImage('${image.id}')"
                                        data-likes="${image.metadata.likes}">
                                    <i class="fas fa-heart"></i>
                                    <span class="text-xs ml-1 like-count">${image.metadata.likes}</span>
                                </button>
                                <a href="/proxy-download/${image.id}" 
                                   class="text-white/60 hover:text-white transition-colors"
                                   onclick="incrementDownloads('${image.id}')">
                                    <i class="fas fa-download"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = newImages;
    }

    function showMessage(message, type = 'info') {
        console.log(`Showing message: ${message} (${type})`);
        const messageDiv = document.getElementById('message');
        if (!messageDiv) {
            console.error('Message div not found');
            return;
        }

        messageDiv.textContent = message;
        messageDiv.className = `message ${type} p-4 rounded-lg text-white fixed top-4 right-4 z-50`;
        
        if (type === 'error') {
            messageDiv.style.backgroundColor = 'rgba(220, 38, 38, 0.9)';
        } else {
            messageDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
        }
        
        messageDiv.style.display = 'block';

        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }

    // Like and Download functionality
    window.likeImage = function(imageId) {
        const button = document.querySelector(`button[onclick="likeImage('${imageId}')"]`);
        const likeCount = button.querySelector('.like-count');

        fetch('/like-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageId: imageId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                button.dataset.likes = data.likes;
                likeCount.textContent = data.likes;
                button.classList.toggle('active');
            }
        })
        .catch(error => console.error('Error:', error));
    };

    window.incrementDownloads = function(imageId) {
        fetch('/increment-downloads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ imageId: imageId })
        })
        .catch(error => console.error('Error:', error));
    };

    // UI helper functions
    function showLoading() {
        hideAllSections();
        loadingSpinner.classList.remove('hidden');
        generateBtn.disabled = true;
        imageContainer.classList.add('hidden');
        errorMessage.classList.add('hidden');
        
        // Update loading text periodically
        let dots = '';
        const loadingText = loadingSpinner.querySelector('.loading-text');
        const baseText = 'Creating your masterpiece';
        
        if (window.loadingInterval) {
            clearInterval(window.loadingInterval);
        }
        
        window.loadingInterval = setInterval(() => {
            dots = dots.length >= 3 ? '' : dots + '.';
            if (loadingText) {
                loadingText.textContent = baseText + dots;
            }
        }, 500);
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    async function loadGeneratedImage(imageUrl) {
        return new Promise((resolve, reject) => {
            const img = document.getElementById('generated-image');
            
            const loadTimeout = setTimeout(() => {
                loadingSpinner.classList.add('hidden');
                reject(new Error('Image loading timed out'));
            }, 30000); // 30 second timeout
            
            img.onload = () => {
                clearTimeout(loadTimeout);
                if (window.loadingInterval) {
                    clearInterval(window.loadingInterval);
                }
                loadingSpinner.classList.add('hidden');
                imageContainer.classList.remove('hidden');
                generateBtn.disabled = false;
                resolve();
            };
            
            img.onerror = () => {
                clearTimeout(loadTimeout);
                loadingSpinner.classList.add('hidden');
                reject(new Error('Failed to load the generated image'));
            };
            
            // Set image source to trigger loading
            img.src = imageUrl;
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        loadingSpinner.classList.add('hidden');
        generateBtn.disabled = false;
    }

    function hideAllSections() {
        [loadingSpinner, imageContainer, errorMessage].forEach(section => {
            section.classList.add('hidden');
        });
    }

    // Enhanced navbar scroll effect
    let lastScroll = 0;
    const navbarHeight = navbar.offsetHeight;
    
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        // Add shadow and adjust background opacity based on scroll
        if (currentScroll > navbarHeight) {
            navbar.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        } else {
            navbar.style.boxShadow = 'none';
            navbar.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }
        
        // Hide/show navbar based on scroll direction
        if (currentScroll > lastScroll && currentScroll > navbarHeight) {
            navbar.style.transform = 'translateY(-100%)';
        } else {
            navbar.style.transform = 'translateY(0)';
        }
        
        lastScroll = currentScroll;
    });

    // Smooth scroll with enhanced active section highlight
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.7
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const prompt = this.getAttribute('data-prompt');
            if (prompt) {
                promptInput.value = prompt;
                generateImage();
            }
        });
    });

    // Pagination state
    let currentPage = 1;
    let totalPages = 1;

    // Function to load images for a specific page
    async function loadLatestImages(page = 1) {
        try {
            const response = await fetch(`/latest-images?page=${page}`);
            const data = await response.json();
            
            if (data.success) {
                updateLatestImages(data.images);
                updatePagination(data.pagination);
            } else {
                throw new Error(data.error || 'Failed to load images');
            }
        } catch (error) {
            console.error('Error loading images:', error);
            showMessage('Failed to load images. Please try again.', 'error');
        }
    }

    // Function to update pagination controls
    function updatePagination(pagination) {
        currentPage = pagination.current_page;
        totalPages = pagination.total_pages;
        
        const pageNumbers = document.getElementById('page-numbers');
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        
        // Update button states
        prevBtn.disabled = currentPage === 1;
        nextBtn.disabled = currentPage === totalPages;
        
        // Generate page numbers
        let pageNumbersHtml = '';
        for (let i = 1; i <= totalPages; i++) {
            if (
                i === 1 || // First page
                i === totalPages || // Last page
                (i >= currentPage - 1 && i <= currentPage + 1) // Pages around current page
            ) {
                pageNumbersHtml += `
                    <button class="glass-button px-4 py-2 rounded-lg ${i === currentPage ? 'bg-white/20' : ''}"
                            data-page="${i}">
                        ${i}
                    </button>
                `;
            } else if (
                (i === 2 && currentPage > 3) ||
                (i === totalPages - 1 && currentPage < totalPages - 2)
            ) {
                pageNumbersHtml += '<span class="px-2">...</span>';
            }
        }
        
        pageNumbers.innerHTML = pageNumbersHtml;
        
        // Add click event listeners to the newly created buttons
        pageNumbers.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                const pageNum = parseInt(button.dataset.page);
                loadLatestImages(pageNum);
            });
        });
    }

    // Event listeners for pagination controls
    document.getElementById('prev-page')?.addEventListener('click', () => {
        if (currentPage > 1) {
            loadLatestImages(currentPage - 1);
        }
    });

    document.getElementById('next-page')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            loadLatestImages(currentPage + 1);
        }
    });

    // Initial load of first page
    loadLatestImages(1);

    // Download functionality for generated images
    document.getElementById('download-btn')?.addEventListener('click', async () => {
        const image = document.getElementById('generated-image');
        if (!image || !image.dataset.imageId) {
            showMessage('No image to download', 'error');
            return;
        }

        try {
            const imageId = image.dataset.imageId;
            window.location.href = `/proxy-download/${imageId}`;
            
            // Track download
            fetch('/increment-downloads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ imageId: imageId })
            }).catch(console.error);
        } catch (error) {
            console.error('Download error:', error);
            showMessage('Failed to download image. Please try again.', 'error');
        }
    });

    // Image actions
    document.querySelector('.download-btn')?.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = generatedImage.src;
        link.download = 'generated-image.png';
        link.click();
    });

    document.querySelector('.share-btn')?.addEventListener('click', async () => {
        try {
            await navigator.share({
                title: 'My Generated Image',
                text: 'Check out this image I created with ImoGenerator!',
                url: window.location.href
            });
        } catch (err) {
            console.log('Error sharing:', err);
        }
    });

    document.querySelector('.like-btn')?.addEventListener('click', function() {
        this.classList.toggle('liked');
        const icon = this.querySelector('i');
        icon.classList.toggle('fas');
        icon.classList.toggle('far');
    });

    // Parallax effect for background blobs
    document.addEventListener('mousemove', (e) => {
        const blobs = document.querySelectorAll('.animate-blob');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;

        blobs.forEach((blob, index) => {
            const speed = (index + 1) * 20;
            const x = (mouseX * speed) - (speed / 2);
            const y = (mouseY * speed) - (speed / 2);
            blob.style.transform = `translate(${x}px, ${y}px) scale(1)`;
        });
    });

    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !generateBtn.disabled) {
            generateImage();
        }
    });
});
