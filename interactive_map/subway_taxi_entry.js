    mapboxgl.accessToken = 'pk.eyJ1IjoiY3R5MDcwMyIsImEiOiJjamc4eGNjbWkwZmN4MzNxZWMyOXdzc3c5In0.TmogLdS4xqZwi3TOS5B9Gw';

		var breaks = Array.apply(null, Array(7)).map(function (_, i) {return i*5000;});
		var breaks2 = Array.apply(null, Array(7)).map(function (_, i) {return i*30000;});

		// Set innerHTML volumes with rounded up values from breaks
		var labels = document.getElementsByClassName('label')
		var labels2 = document.getElementsByClassName('label2')

		var getTextLabel = function(v){
			if (v < 1000){
				return String(v)
			}
			else if(v < 1000000){
				return String(Math.floor(v/1000))+"k"
			}
			else{
				return String(Math.floor(v/1000000))+"m"
			}
		};

		labels[0].innerHTML = "< " + getTextLabel(breaks[1])
		labels2[0].innerHTML = "< " + getTextLabel(breaks2[1])

		for (var i = 1; i < labels.length-1; i++){
			var value = breaks[i],
					value_next = breaks[i+1]
			var value2 = breaks2[i],
					value_next2 = breaks2[i+1]

			var textString = getTextLabel(value),
					textStringNext = getTextLabel(value_next)
			var textString2 = getTextLabel(value2),
					textStringNext2 = getTextLabel(value_next2)

			labels[i].innerHTML = textString+"-"+textStringNext
			labels2[i].innerHTML = textString2+"-"+textStringNext2

		}
		// Set last label
		labels[labels.length-1].innerHTML = getTextLabel(breaks[labels.length-1])+"+"
		labels2[labels2.length-1].innerHTML = getTextLabel(breaks2[labels2.length-1])+"+"

    var map = new mapboxgl.Map({
      container: 'mapLeft',
      style: 'mapbox://styles/hw2312/cjfhmrha4b9932rqg54tvdv4n',
      center: [-73.98,40.782],
      zoom: 11.2,
      bearing: 29,
      title: "subway"
    });

		var map2 = new mapboxgl.Map({
      container: 'mapRight',
      style: 'mapbox://styles/hw2312/cjfhmrha4b9932rqg54tvdv4n',
      center: [-73.98,40.782],
      zoom: 11.2,
      bearing: 29
    });

		function getGridForHour(mapElement,property, hour, isWeekend, shape_width, breaks){

			if(mapElement.getSource('squareGrid')){
				for(b in breaks){
					if (b > 0) mapElement.removeLayer("subwaySquareGrid-"+b)
				}
				// Remove max layer
				mapElement.removeLayer("subwaySquareGrid-"+(parseInt(b)+1))
				mapElement.removeSource('squareGrid');

			}
			var weekendFilter = (function(isWeekend){
				switch(isWeekend){
					case 'weekday':
						return ['==',['get','is_weekend_or_holiday'],0]
						break;
					case 'weekend':
						return ['==',['get','is_weekend_or_holiday'],1]
						break;
				}
			});

			var queryObject = {
				sourceLayer:"entry-841uuk",
				filter:['all',['==',['get','hour'],hour]]
			}

			if(isWeekend != 'all')
				queryObject.filter.push(weekendFilter(isWeekend))

			var filtered_data = mapElement.querySourceFeatures("entry",queryObject);

      // Create array of stations with filtered properties
      var a = []
      for (var i = 0; i < filtered_data.length; i ++){
        var geom = turf.getGeom(filtered_data[i])
        a.push(turf.point([geom.coordinates[0],geom.coordinates[1]],filtered_data[i].properties))
      }

      // Create envelope for encompassing all vertices
      var fcollections = turf.featureCollection(filtered_data)
      var pointFC = turf.featureCollection(a)

      var enveloped = turf.envelope(fcollections)

      //CREATE A GRID
      //must be in order: minX, minY, maxX, maxY ... you have to pick these out from your envelope that you created previously
      var bbox = [enveloped.geometry.coordinates[0][0][0]-0.025,
                  enveloped.geometry.coordinates[0][0][1]-0.025,
                  enveloped.geometry.coordinates[0][2][0]+0.025,
                  enveloped.geometry.coordinates[0][2][1]+0.025];
      var cellWidth = shape_width // Make sure this is not too big
      var hexgrid = turf.squareGrid(bbox,cellWidth);

      // console.log(fcollections)
      var collected = turf.collect(hexgrid,pointFC,property,'total')

			var volume_array = []
			for(var i = 0; i < collected.features.length; i++){
				var props = collected.features[i].properties

				// If not empty, add sum all values
				collected.features[i].properties.total = props.total.length > 0 ? props.total.reduce((a,b) => parseInt(a)+parseInt(b)) : 0
				volume_array.push(collected.features[i].properties.total)
			}

			mapElement.addSource('squareGrid',{
         "type": "geojson",
         "data": collected
      });

			// Returns array of 6 numbers, with min and max as breaks[0] and breaks[breaks.length-1], or use hard-coded breaks
			// var breaks = ss.equalIntervalBreaks(volume_array,5)

			var colors = ['#ffffff', '#ffffcc','#fed976','#fd8d3c','#e04b25','#a30e11'],
					transparency = [0.3,0.5,0.5,0.5,0.5,0.5],
					maxColor = '#560000',
					maxTransparency = 0.5

			for(b in breaks){
				if (b > 0){
					mapElement.addLayer({
					 "id": "subwaySquareGrid-" + b,
					 "type": "fill",
					 "source": "squareGrid",
					 "layout": {},
					 "paint":{
						 'fill-color': colors[b-1],
						 'fill-opacity': transparency[b-1],
						 'fill-outline-color':'#ffffff'
					 }
				 },"road-label-small");
			 }
			}

			for(var i = 0; i < breaks.length; i++){
				if (i > 0){
					var filters = ['all',['>',['to-number',['get','total']],breaks[i-1]],['<=',['to-number',['get','total']],breaks[i]]]
					mapElement.setFilter('subwaySquareGrid-' + i, filters)
					// debugger
				}
			}

			// Add another layer for max
			mapElement.addLayer({
			 "id": "subwaySquareGrid-" + i,
			 "type": "fill",
			 "source": "squareGrid",
			 "layout": {},
			 "paint":{
				 'fill-color': maxColor,
				 'fill-opacity': maxTransparency,
				 'fill-outline-color':'#ffffff'
			 }
		 },"road-label-small");
			var filters = ['all',['>',['to-number',['get','total']],breaks[breaks.length-1]]]
			mapElement.setFilter('subwaySquareGrid-' + i, filters)

		}

		function loadSourceLayer(mapElement){
			mapElement.addSource("entry",{
          type:"vector",
          url:"mapbox://cty0703.27oq1n2c"
      })

      mapElement.addLayer({
          id: "stations",
          type: "circle",
          source: "entry",
          'source-layer': "entry-841uuk",
          paint: {
            'circle-radius':3,
            'circle-stroke-color':"#ffffff",
            'circle-stroke-width':1,
            'circle-stroke-opacity':0.5,
            'circle-color': "#ea9800",
            'circle-opacity':1
          }
      },'road-label-small')

			return
		}

		// Add sources
    map.on('load',function(){
			loadSourceLayer(map)
			loadSourceLayer(map2)
    });

		document.getElementById('renderbutton').addEventListener('click',function(){
			var slider = document.getElementById('slider')
			var hour = parseInt(slider.value) % 24;

			var isWeekend = (function(){
				var inputs = document.getElementsByTagName("input")
				for(elem in inputs){
					if(inputs[elem].type == "radio" && inputs[elem].checked)
						return inputs[elem].value
				}
			});

			getGridForHour(map,'entry_volume', hour, isWeekend(), 1, breaks2)
			getGridForHour(map2,'exit_volume', hour, isWeekend(), 1, breaks)

		});
		document.getElementById('slider').addEventListener('input', function(e) {
			var hour = parseInt(e.target.value) % 24;

			// converting 0-24 hour to AMPM format
			var ampm = hour >= 12 ? 'PM' : 'AM';
			var hour12 = hour % 12 ? hour % 12 : 12;

			var prior_hour = hour == 0 ? 20 : hour - 4
			var prior_ampm = prior_hour >= 12 ? 'PM' : 'AM';
			var prior_hour12 = prior_hour % 12 ? prior_hour % 12 : 12;

			// update text in the UI
			document.getElementById('active-hour').innerText = prior_hour12 + prior_ampm + " to " + hour12 + ampm;
		});


map.on('click', 'stations', function (e) {
   var coordinates = e.features[0].geometry.coordinates.slice();
   var station = e.features[0].properties.station;
   var lines = e.features[0].properties.lines;

   // Ensure that if the map is zoomed out such that multiple
   // copies of the feature are visible, the popup appears
   // over the copy being pointed to.
   while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
       coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
   }

   var popupHTML = `<p><strong>Station: </strong>${station}</p>\
                    <p><strong>Lines: </strong>${lines}</p>`

   new mapboxgl.Popup()
       .setLngLat(coordinates)
       .setHTML(popupHTML)
       .addTo(map);
});

map2.on('click', 'stations', function (e) {
   var coordinates = e.features[0].geometry.coordinates.slice();
   var station = e.features[0].properties.station;
   var lines = e.features[0].properties.lines;

   // Ensure that if the map is zoomed out such that multiple
   // copies of the feature are visible, the popup appears
   // over the copy being pointed to.
   while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
       coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
   }

   var popupHTML = `<p><strong>Station: </strong>${station}</p>\
                    <p><strong>Lines: </strong>${lines}</p>`

   new mapboxgl.Popup()
       .setLngLat(coordinates)
       .setHTML(popupHTML)
       .addTo(map2);
});

// Change the cursor to a pointer when the mouse is over the stations layer.
map.on('mouseenter', 'stations', function () {
    map.getCanvas().style.cursor = 'pointer';
});

// Change it back to a pointer when it leaves.
map.on('mouseleave', 'stations', function () {
    map.getCanvas().style.cursor = '';
});

// Change the cursor to a pointer when the mouse is over the stations layer.
map2.on('mouseenter', 'stations', function () {
    map2.getCanvas().style.cursor = 'pointer';
});

// Change it back to a pointer when it leaves.
map2.on('mouseleave', 'stations', function () {
    map2.getCanvas().style.cursor = '';
});
