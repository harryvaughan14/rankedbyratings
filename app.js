// Firebase configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDOz_C363nVZWo-Va5fSrC5IEOhm10eTyM",
  authDomain: "rankedbyratings.firebaseapp.com",
  databaseURL: "https://rankedbyratings-default-rtdb.firebaseio.com",
  projectId: "rankedbyratings",
  storageBucket: "rankedbyratings.firebasestorage.app",
  messagingSenderId: "1038168946432",
  appId: "1:1038168946432:web:0535ae3f1ff7e83dee65e5"
};

const CATEGORIES = ['Utility', 'Aesthetic', 'Cultural Impact', 'Versatility', 'Sustainability'];

function DailyRanker() {
  const [currentObject, setCurrentObject] = React.useState('');
  const [ratings, setRatings] = React.useState({});
  const [comment, setComment] = React.useState('');
  const [hasVotedToday, setHasVotedToday] = React.useState(false);
  const [allRankings, setAllRankings] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [firebaseReady, setFirebaseReady] = React.useState(false);
  const [userId, setUserId] = React.useState('');

  const getTodayKey = () => {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  };

  const getUserId = () => {
    let id = localStorage.getItem('dailyRankerUserId');
    if (!id) {
      id = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
      localStorage.setItem('dailyRankerUserId', id);
    }
    return id;
  };

  React.useEffect(() => {
    initializeFirebase();
    setUserId(getUserId());
  }, []);

  const initializeFirebase = async () => {
    try {
      if (firebase.apps.length === 0) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      setFirebaseReady(true);
      loadData();
    } catch (error) {
      console.error('Firebase initialization error:', error);
      setLoading(false);
    }
  };

  const generateDailyObject = async (dateKey) => {
    try {
      const db = firebase.database();
      
      const todayObjectRef = db.ref(`dailyObjects/${dateKey}`);
      const snapshot = await todayObjectRef.once('value');
      
      if (snapshot.exists()) {
        return snapshot.val().noun;
      }
      
      const response = await fetch('https://random-word-api.herokuapp.com/word?number=1&type=noun');
      const words = await response.json();
      let noun = words[0];
      
      noun = noun.charAt(0).toUpperCase() + noun.slice(1);
      
      await todayObjectRef.set({
        noun: noun,
        date: dateKey,
        timestamp: Date.now()
      });
      
      return noun;
    } catch (error) {
      console.error('Error generating daily object:', error);
      const fallbackNouns = ['Umbrella', 'Book', 'Chair', 'Lamp', 'Clock'];
      const hash = dateKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return fallbackNouns[hash % fallbackNouns.length];
    }
  };

  const loadData = async () => {
    if (!firebaseReady) return;
    
    setLoading(true);
    const todayKey = getTodayKey();
    const objectForToday = await generateDailyObject(todayKey);
    setCurrentObject(objectForToday);

    try {
      const db = firebase.database();
      
      const voteSnapshot = await db.ref(`userVotes/${userId}/${todayKey}`).once('value');
      setHasVotedToday(voteSnapshot.exists());

      const rankingsSnapshot = await db.ref('rankings').once('value');
      const rankingsData = rankingsSnapshot.val();
      
      if (rankingsData) {
        const rankingsArray = Object.values(rankingsData)
          .sort((a, b) => b.avgRating - a.avgRating);
        setAllRankings(rankingsArray);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  };

  const handleRatingChange = (category, value) => {
    setRatings(prev => ({ ...prev, [category]: value }));
  };

  const handleSubmit = async () => {
    if (Object.keys(ratings).length !== CATEGORIES.length) {
      alert('Please rate all categories before submitting!');
      return;
    }

    const todayKey = getTodayKey();
    
    try {
      const db = firebase.database();
      
      const objectRef = db.ref(`objects/${currentObject}`);
      const objectSnapshot = await objectRef.once('value');
      let objectData = objectSnapshot.val() || {
        name: currentObject,
        date: todayKey,
        totalVotes: 0,
        categoryTotals: {}
      };

      const voteId = db.ref().child('votes').push().key;
      await db.ref(`votes/${currentObject}/${voteId}`).set({
        userId,
        ratings,
        comment: comment.trim(),
        timestamp: Date.now()
      });

      objectData.totalVotes += 1;
      CATEGORIES.forEach(cat => {
        if (!objectData.categoryTotals[cat]) objectData.categoryTotals[cat] = 0;
        objectData.categoryTotals[cat] += ratings[cat];
      });

      const overallTotal = Object.values(objectData.categoryTotals).reduce((a, b) => a + b, 0);
      const avgRating = overallTotal / (CATEGORIES.length * objectData.totalVotes);

      objectData.avgRating = avgRating;

      await objectRef.set(objectData);

      await db.ref(`rankings/${currentObject}`).set({
        name: currentObject,
        date: todayKey,
        avgRating,
        totalVotes: objectData.totalVotes
      });

      await db.ref(`userVotes/${userId}/${todayKey}`).set(true);

      await loadData();
      
      setRatings({});
      setComment('');
    } catch (error) {
      console.error('Error saving vote:', error);
      alert('Error saving your vote. Please try again.');
    }
  };

  if (loading) {
    return React.createElement('div', {
      className: "min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
    }, React.createElement('div', { className: "text-white text-2xl" }, 'Loading...'));
  }

  if (!firebaseReady) {
    return React.createElement('div', {
      className: "min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center p-4"
    }, React.createElement('div', {
      className: "bg-white rounded-2xl shadow-2xl p-8 max-w-2xl"
    }, [
      React.createElement('h2', { key: 'title', className: "text-2xl font-bold text-gray-800 mb-4 text-center" }, 'Firebase Setup Required'),
      React.createElement('div', { key: 'content', className: "text-gray-600" }, 
        'Please check console for errors.')
    ]));
  }

  return React.createElement('div', { className: "min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4" },
    React.createElement('div', { className: "max-w-4xl mx-auto" }, [
      React.createElement('header', { key: 'header', className: "text-center mb-8 pt-8" }, [
        React.createElement('h1', { key: 'title', className: "text-5xl font-bold text-white mb-2" }, 'Daily Ranker'),
        React.createElement('p', { key: 'subtitle', className: "text-purple-100 text-lg" }, 'Rate today\'s random object with the community')
      ]),
      React.createElement('div', { key: 'voting', className: "bg-white rounded-2xl shadow-2xl p-8 mb-6" }, [
        React.createElement('div', { key: 'header', className: "text-center mb-8" }, [
          React.createElement('div', { key: 'emoji', className: "text-6xl mb-4" }, '📦'),
          React.createElement('h3', { key: 'object', className: "text-4xl font-bold text-purple-600 mb-2" }, currentObject),
          React.createElement('p', { key: 'date', className: "text-gray-500" }, getTodayKey())
        ]),
        !hasVotedToday ? React.createElement('div', { key: 'form' }, [
          React.createElement('div', { key: 'ratings', className: "space-y-6 mb-6" },
            CATEGORIES.map(category => 
              React.createElement('div', { key: category }, [
                React.createElement('div', { key: 'label', className: "flex justify-between items-center mb-2" }, [
                  React.createElement('label', { key: 'text', className: "text-lg font-semibold text-gray-700" }, category),
                  React.createElement('span', { key: 'value', className: "text-2xl font-bold text-purple-600" }, ratings[category] || 0)
                ]),
                React.createElement('input', {
                  key: 'slider',
                  type: 'range',
                  min: '0',
                  max: '100',
                  value: ratings[category] || 0,
                  onChange: (e) => handleRatingChange(category, parseInt(e.target.value)),
                  className: "w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500",
                  style: {
                    background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${ratings[category] || 0}%, #e5e7eb ${ratings[category] || 0}%, #e5e7eb 100%)`
                  }
                }),
                React.createElement('div', { key: 'scale', className: "flex justify-between text-xs text-gray-500 mt-1" }, [
                  React.createElement('span', { key: '0' }, '0'),
                  React.createElement('span', { key: '50' }, '50'),
                  React.createElement('span', { key: '100' }, '100')
                ])
              ])
            )
          ),
          React.createElement('div', { key: 'comment', className: "mb-6" }, [
            React.createElement('label', { key: 'label', className: "text-lg font-semibold text-gray-700 mb-3 block" }, 'Comment (Optional)'),
            React.createElement('textarea', {
              key: 'input',
              value: comment,
              onChange: (e) => setComment(e.target.value),
              placeholder: 'Share your thoughts...',
              className: "w-full p-4 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none resize-none",
              rows: 3
            })
          ]),
          React.createElement('button', {
            key: 'submit',
            onClick: handleSubmit,
            disabled: Object.keys(ratings).length !== CATEGORIES.length,
            className: "w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-lg font-bold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          }, 'Submit Ratings')
        ]) : React.createElement('div', { key: 'voted', className: "text-center py-8" }, [
          React.createElement('div', { key: 'emoji', className: "text-6xl mb-4" }, '✅'),
          React.createElement('p', { key: 'title', className: "text-xl font-semibold text-gray-700" }, 'You\'ve voted today!'),
          React.createElement('p', { key: 'subtitle', className: "text-gray-500 mt-2" }, 'Come back tomorrow for a new object')
        ])
      ]),
      React.createElement('div', { key: 'rankings', className: "bg-white rounded-2xl shadow-2xl p-8" }, [
        React.createElement('h2', { key: 'title', className: "text-2xl font-bold text-gray-800 mb-6" }, 'All-Time Rankings'),
        allRankings.length === 0 ? 
          React.createElement('p', { key: 'empty', className: "text-center text-gray-500 py-8" }, 'No rankings yet. Be the first to vote!') :
          React.createElement('div', { key: 'list', className: "space-y-3" },
            allRankings.map((item, index) =>
              React.createElement('div', {
                key: item.name,
                className: "flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg hover:shadow-md transition-shadow"
              }, [
                React.createElement('div', { 
                  key: 'rank',
                  className: `text-2xl font-bold ${
                    index === 0 ? 'text-yellow-500' :
                    index === 1 ? 'text-gray-400' :
                    index === 2 ? 'text-orange-600' :
                    'text-gray-500'
                  }`
                }, `#${index + 1}`),
                React.createElement('div', { key: 'info', className: "flex-1" }, [
                  React.createElement('h3', { key: 'name', className: "font-bold text-lg text-gray-800" }, item.name),
                  React.createElement('p', { key: 'meta', className: "text-sm text-gray-500" }, `${item.totalVotes} votes • ${item.date}`)
                ]),
                React.createElement('span', { key: 'score', className: "text-2xl font-bold text-purple-600" }, item.avgRating.toFixed(1))
              ])
            )
          )
      ])
    ])
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(DailyRanker));