document.addEventListener('DOMContentLoaded', () => {
    async function initializeFirebase() {
        try {
            // Direct de config gebruiken in plaats van ophalen
            firebase.initializeApp(config.firebase);
            
            // Maak Firebase services globaal beschikbaar
            window.auth = firebase.auth();
            window.db = firebase.firestore();
            window.user = null;

            // Dispatch een custom event wanneer Firebase klaar is
            document.dispatchEvent(new Event('firebaseInitialized'));
            
            console.log('Firebase succesvol geïnitialiseerd.');
        } catch (error) {
            console.error('Fout bij het initialiseren van Firebase:', error);
        }
    }

    // Start initialisatie
    initializeFirebase();
});