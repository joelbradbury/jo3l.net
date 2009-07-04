$(document).ready(function() {
    $("#badge .badge").bind("mouseenter",function(){
			$(this).animate( { width:'224px' },{queue:false, duration: 500 } );			
    }).bind("mouseleave",function(){
				$(this).animate( { width:'60px' }, {queue:false, duration: 500 } );
    });		
});

