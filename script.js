'use strict';

const modal = document.querySelector('.modal');
const delAllBtn = document.querySelector('.delete__all--ic');
const delBtn = document.querySelectorAll('.delete__ic');
const modalMessage = document.querySelector('.modal__message');
const sidebar = document.querySelector('.sidebar');
const form = document.querySelector('.form');
const mapDiv = document.querySelector('#map');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortBtn = document.querySelector('.sort__workouts');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  markerId;

  constructor(coords, distance, duration) {
    this.coords = coords;
    this.distance = distance;
    this.duration = duration;
  }

  _setDescriptionTitle() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescriptionTitle();
  }

  calcPace() {
    // Minutes / kilometer
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescriptionTitle();
  }

  calcSpeed() {
    // Km / Hour
    this.speed = this.distance / (this.duration / 60);
  }
}
/* 
const run1 = new Running([-7.8026, 110.365], 40, 120, 170);
const cyc1 = new Cycling([-7.8026, 110.365], 70, 100, 525);
console.log(run1, cyc1);
 */
//////////////////////////////////////////

///////   APPLICATION ARCHITECTURE
class App {
  #map;
  #mapEvent;

  #workouts = [];
  #modalTimeout;
  sorted = false;

  constructor() {
    // Data Wipe Out Message
    if (localStorage.getItem('message')) {
      const m = localStorage.getItem('message');
      const [type, message] = m.split(':');
      setTimeout(() => {
        this._modalShow(type, message);
      }, 450);
      localStorage.removeItem('message');
    }

    // Set Modal behavior
    this._modalInit();
    this._modalUpdatePosition();

    // Get User's position
    this._getPosition();

    // Get Local Storage
    this._getLocalStorage();

    // Attach event handlers
    sidebar.addEventListener('click', this._hideForm.bind(this));
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    delAllBtn.addEventListener('click', this.reset.bind(this));
    sortBtn.addEventListener('change', this._sortWorkouts.bind(this));
  }

  _sortWorkouts(e) {
    e.preventDefault();
    e.target.value === 'false' ? (this.sorted = false) : (this.sorted = true);
    const sortedWorkouts = this.sorted
      ? this.#workouts
          .slice()
          .sort((a, b) => a[e.target.value] - b[e.target.value])
      : this.#workouts;
    const prevWorkout = containerWorkouts.querySelectorAll('.workout');
    prevWorkout.forEach(pw => {
      pw.remove();
    });
    sortedWorkouts.forEach(sWorkout => {
      this._renderWorkout(sWorkout);
    });
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your Position');
        }
      );
  }

  _loadMap(position) {
    // Destructuring methods
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // Rendering Map View
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, 13);
    // console.log(this.#map);

    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    /* L.marker(coords)
      .addTo(this.#map)
      .bindPopup('A pretty CSS popup.<br> Easily customizable.')
      .openPopup(); */

    // Handling click event on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _setFormDefaultLocation() {
    document.querySelector('.workouts').prepend(form);
  }

  _resetFormInputs() {
    inputType.value = 'running';
    inputType.removeAttribute('disabled');
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
  }

  _showForm(mapE) {
    if (mapE) {
      this.#mapEvent = mapE;
      this._setFormDefaultLocation();
      if (document.querySelector('.workout[style="display: none;"]')) {
        document.querySelector(
          '.workout[style="display: none;"]'
        ).style.display = 'grid';
      }
      this._resetFormInputs();
    }
    form.classList.remove('hidden');
    this._closeActionEl();
    inputDistance.focus();
  }

  _hideForm(e) {
    const formIsClicked = e?.target.closest('.form');
    const editIsClicked = e?.target.closest('.workout');
    if (formIsClicked || editIsClicked) return;
    this._resetFormInputs();
    if (e) {
      form.classList.add('hidden');
      if (document.querySelector('.workout[style="display: none;"]'))
        document.querySelector(
          '.workout[style="display: none;"]'
        ).style.display = 'grid';
    } else {
      form.style.display = 'none';
      form.classList.add('hidden');
      setTimeout(() => (form.style.display = 'grid'), 1000);
    }
    this._setFormDefaultLocation();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.value = inputCadence.value = '';
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    e.preventDefault();
    const validPositive = (...inputs) => inputs.every(inp => inp > 0);

    // Retrieve data form Form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let lat, lng;
    if (e) {
      lat = this.#mapEvent ? this.#mapEvent.latlng.lat : null;
      lng = this.#mapEvent ? this.#mapEvent.latlng.lng : null;
    }
    let workout;

    // If workout running, create running object and vice versa for cycling
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !validPositive(distance, duration, cadence)
      )
        return this._modalShow(
          'danger',
          'Inputs have to be number and positive (greater than 0)'
        );

      if (document.querySelector('.workout[style="display: none;"]')) {
        const workoutId = document.querySelector(
          '.workout[style="display: none;"]'
        ).dataset.id;
        return this._submitEdit(workoutId, distance, duration, cadence);
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    } else if (type === 'cycling') {
      const elevationGain = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevationGain) ||
        !validPositive(distance, duration)
      )
        return this._modalShow(
          'danger',
          'Inputs have to be number and positive (greater than 0)'
        );

      if (document.querySelector('.workout[style="display: none;"]')) {
        const workoutId = document.querySelector(
          '.workout[style="display: none;"]'
        ).dataset.id;
        return this._submitEdit(workoutId, distance, duration, elevationGain);
      }

      workout = new Cycling([lat, lng], distance, duration, elevationGain);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Display Marker
    this._renderWorkoutMarker(workout);

    // Render Workout List
    this._renderWorkout(workout);

    // Show modal
    this._modalShow('success', 'Yeay ! Workout successfully added');

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(`${workout.description}`)
      .openPopup();
    workout.markerId = marker._leaflet_id;
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details workout__details--distance">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details workout__details--duration">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running') {
      html += `
          <div class="workout__details workout__details--speed">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details workout__details--cadence">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
      `;
    } else {
      html += `
          <div class="workout__details workout__details--speed">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details workout__details--elevationGain">
            <span class="workout__icon">🗻</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
      `;
    }

    html += `
        <div class="workout__options hidden">
          <span
            class="material-symbols-outlined action__btn delete__ic"
            title="Delete Workout"
          >
            delete
          </span>
          <span
            class="material-symbols-outlined action__btn edit__ic"
            title="Edit Workout"
          >
            edit
          </span>
        </div
      </li>
    `;
    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    this._closeActionEl();
    if (!workoutEl) return;
    if (document.querySelector('.workout[style="display: none;"]')) {
      document.querySelector('.workout[style="display: none;"]').style.display =
        'grid';
      this._hideForm();
      this._setFormDefaultLocation();
    }
    const actionEL = workoutEl.lastElementChild;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    this.#map.flyTo(workout.coords, 13, {
      animate: true,
      pan: { duration: 1, easeLinearity: 0.75 },
    });

    if (e.target.classList.contains('delete__ic')) {
      this._deleteWorkout(workout);
    }
    if (e.target.classList.contains('edit__ic')) {
      this._editWorkout(workout);
    }
    if (actionEL.classList.contains('hidden'))
      actionEL.classList.toggle('hidden');

    workout.click();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = localStorage.getItem('workouts');

    if (!data) return;
    this.#workouts = JSON.parse(data);
    this.#workouts.forEach((work, i) => {
      if (work.type === 'running') {
        work.__proto__ = new Running(
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
      } else {
        work.__proto__ = new Cycling(
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain
        );
      }
      this.#workouts[i] = work;
      this._renderWorkout(work);
    });
  }

  reset() {
    // console.log(this);
    if (localStorage.getItem('workouts')) {
      localStorage.removeItem('workouts');
      localStorage.setItem(
        'message',
        'success:Successfully delete all workouts !'
      );
      location.reload();
    } else {
      this._modalShow(
        'danger',
        'There is no workout to be deleted. Try to add one by clicking the map !'
      );
    }
  }

  _closeActionEl() {
    const openedAction = [
      ...document.querySelectorAll('.workout__options'),
    ].filter(opt => !opt.classList.contains('hidden'));
    openedAction[0]?.classList.toggle('hidden');
  }

  _deleteWorkout(workout) {
    document.querySelector(`.workout[data-id="${workout.id}"]`).remove();
    this.#map.removeLayer(this.#map._layers[`${workout.markerId}`]);
    this.#workouts.splice(this.#workouts.indexOf(workout), 1);
    this.#workouts.length > 0
      ? this._setLocalStorage()
      : localStorage.removeItem('workouts');
    this._modalShow('success', 'Workout successfully deleted !');
  }

  _editWorkout(workout) {
    const workoutEl = document.querySelector(
      `.workout[data-id="${workout.id}"]`
    );
    form.parentElement.insertBefore(form, workoutEl);
    workoutEl.style.display = 'none';
    this._showForm();
    inputType.value = workout.type;
    inputType.disabled = true;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    if (workout.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.value = inputCadence.value = '';
      inputCadence.value = workout.cadence;
    } else {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = inputCadence.value = '';
      inputElevation.value = workout.elevationGain;
    }
  }

  _submitEdit(workoutId, distance, duration, cadenceOrElevationGain) {
    const currWorkout = document.querySelector(
      `.workout[data-id="${workoutId}"]`
    );
    this.#workouts.find(function (work) {
      if (work.id === workoutId) {
        const currWorkoutDistance = (currWorkout.querySelector(
          '.workout__details--distance > .workout__value'
        ).textContent = distance);
        const currWorkoutDuration = (currWorkout.querySelector(
          '.workout__details--duration > .workout__value'
        ).textContent = duration);

        work.distance = distance;
        work.duration = duration;
        work.type === 'running'
          ? (work.cadence = cadenceOrElevationGain) &&
            (work.pace = duration / distance) &&
            (currWorkout.querySelector(
              '.workout__details--speed > .workout__value'
            ).textContent = work.pace.toFixed(1)) &&
            (currWorkout.querySelector(
              '.workout__details--cadence > .workout__value'
            ).textContent = work.cadence)
          : (work.elevationGain = cadenceOrElevationGain) &&
            (work.speed = distance / (duration / 60)) &&
            (currWorkout.querySelector(
              '.workout__details--speed > .workout__value'
            ).textContent = work.speed.toFixed(1)) &&
            (currWorkout.querySelector(
              '.workout__details--elevationGain > .workout__value'
            ).textContent = work.elevationGain);
      }
    });
    this._hideForm();
    currWorkout.style.display = 'grid';
    this._setLocalStorage();
    this._modalShow('success', 'Successfully edit a workout !');
  }

  _modalInit() {
    const { x, width, top } = mapDiv.getBoundingClientRect();
    modal.style.left = `${x + 25}px`;
    modal.style.bottom = `${top + 10}px`;
    modal.style.width = `${width - 50}px`;
  }

  _modalUpdatePosition() {
    window.onresize = e => {
      this._modalInit();
    };
  }

  _modalShow(type, message) {
    if (this.#modalTimeout) clearTimeout(this.#modalTimeout);
    modal.classList.remove('hidden');
    if (type === 'success') {
      modal.classList.remove('modal__alert--danger');
      modal.classList.add('modal__alert--success');
    } else {
      modal.classList.add('modal__alert--danger');
      modal.classList.remove('modal__alert--success');
    }
    modalMessage.textContent = message;
    const modalTimeout = setTimeout(
      function () {
        modal.classList.add('hidden');
      },
      type === 'success' ? 3000 : 5000
    );
    this.#modalTimeout = modalTimeout;
    return modalTimeout;
  }
}

const app = new App();

/* 
`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'}${workout.distance} KM ⏱${
  workout.duration
} MIN ⚡${
  workout.type === 'running'
    ? workout.pace + ' MIN/KM ' + '🦶' + workout.cadence + ' SPM'
    : workout.speed + ' KM/H' + '🗻' + workout.elevationGain + ' M'
} `
 */
