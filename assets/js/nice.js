var Site = {
	
	start: function(){
		
		if ($('badge')) Site.parseBadges();
		if($('horizontal')) Site.horizontal();
		
	},
	horizontal: function(){
				var list = $$('#horizontal');
				var headings = $$('#touch a');
				var collapsibles = new Array();
				
				headings.each( function(heading, i) {

					var collapsible = new Fx.Slide(list[i], { 
						duration: 500, 
						transition: Fx.Transitions.linear
					});
					
					collapsibles[i] = collapsible;
					
					heading.onclick = function(){
						collapsible.toggle('horizontal');
						return false;
					}
					collapsible.hide('horizontal');
				});
			},
	parseBadges: function(){
		var badges = $$('#badge .badge');
		
		var fx = new Fx.Elements(badges, {wait: false, duration: 200, transition: Fx.Transitions.quadOut});
		
		badges.each(function(badge, i){
			badge.addEvent('mouseenter', function(e){
				var obj = {};
				obj[i] = {
					'width': [badge.getStyle('width').toInt(), 224]
				};
				badges.each(function(other, j){
					if (other != badge){
						var w = other.getStyle('width').toInt();
						if (w != 60) obj[j] = {'width': [w, 60]};
					}
				});
				fx.start(obj);
			});
		});
		
		$('badge').addEvent('mouseleave', function(e){
			var obj = {};
			badges.each(function(other, j){
				obj[j] = {'width': [other.getStyle('width').toInt(), 60]};
			});
			fx.start(obj);
		});
	},
	
	
};
window.addEvent('load', Site.start); 

