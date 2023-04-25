import {LitElement, html, render}   from 'lit';
import {query}                      from 'lit/decorators/query.js';
import {customElement, property}    from 'lit/decorators.js';

import './flowy.css'

export interface Block {
    childwidth: number
    parent: number
    id: number
    x: number
    y: number
    width: number
    height: number
}

export interface BlockData {
    id: number
    parent: number
    data: Array<{ name: string | null, value: string }>
    attr: Array<Record<string, any>>
}

export interface Output {
    html: string
    blockarr: Array<Block>
    blocks: Array<any>
}

function toInt(value: number | string) {
    if (typeof (value) === 'number')
        return parseInt(`${value}`)
    return parseInt(value)
}

const createOrUpdateArrow = ( id:number|HTMLElement, x:number, y:number, paddingy:number = 80, start_x = 20 ): HTMLElement => {

    let arrow:HTMLElement
    if( typeof(id) === 'number') {
        arrow = document.createElement('div')
        arrow.setAttribute( 'id', `arrow${id}` )
        arrow.classList.add( 'arrowblock')
    }
    else {
        arrow = id
    }

    const content = html`
        <svg preserveaspectratio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M${start_x} 0 L${start_x} ${paddingy/2} L${x} ${paddingy/2} L${x} ${y}" 
                stroke="#C5CCD0" 
                stroke-width="2px"/>
            <path d="M${x - 5} ${y - 5} H${x + 5} L${x} ${y} L${x - 5} ${y - 5} Z" 
                fill="#C5CCD0"/>
        </svg>
        `
    render( content, arrow )

    return arrow
}

function hasParentClass(element: HTMLElement, classname: string): boolean {
    if (element.className) {
        if (element.className.split(' ').indexOf(classname) >= 0) return true;
    }
    return (element.parentNode !== null) && hasParentClass(element.parentNode as HTMLElement, classname);
}


const isRightClick = <E extends UIEvent>( event:E ) => ( event instanceof MouseEvent && event.button == 2 /* right click */)


export const blockIdNumber = ( el: HTMLElement ) => {
                
    const value = /block(\d+)/.exec(el!.id)![1]

    return parseInt(value)
}

interface DragContext {
    element: HTMLElement|null // currently dragegd element
    rearrange: boolean
    active: boolean
    dragblock: boolean,
    prevblock: number,            
    blockstemp:Array<Block>,
    dragx: number,
    dragy: number,
    original: HTMLElement|null,
    mouse_x:number,
    mouse_y:number,
    absx: number,
    absy:number,


}

/**
 *  events supported by element
 * 
 * @see {@link https://github.com/Microsoft/TypeScript/issues/9604#issuecomment-231659171|issue #9604} 
 * Overriding addEventListener to augment event objects #9604
 */
export interface FlowyDiagram extends HTMLElement {
    /**
     * event raised when start dragging template over diagram 
     * 
     * @param type 'templateGrabbed'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'templateGrabbed', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when start dragging template over diagram 
     * 
     * @param type 'templateReleased'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'templateReleased', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when a diagram's block is selected 
     * 
     * @param type 'blockSelected'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'blockSelected', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when a block's sheet is closeds 
     * 
     * @param type 'sheetClosed'
     * @param listener (ev: CustomEvent<HTMLElement>) => void
     * @param capture 
     */
    addEventListener(type: 'sheetClosed', listener: (ev: CustomEvent<HTMLElement>) => void, capture?: boolean): void
    /**
     * event raised when a block is dropped from template.
     *  
     * it is a cancellable event, a call to "preventDefault()" cancel dropping block 
     * 
     * @param type 'snapping'
     * @param listener 
     * @param capture 
     */
    addEventListener(type: 'snapping', listener: (ev: CustomEvent<{ target:HTMLElement, parent?: HTMLElement }>) => void, capture?: boolean): void
    /**
     * event raised when a block is dropped after moving over diagram.
     * 
     * it is a cancellable event. A call to "preventDefault()" cancel dropping block  
     * 
     * @param type 'moving'
     * @param listener 
     * @param capture 
     */
    addEventListener(type: 'moving', listener: (ev: CustomEvent<{ source:HTMLElement, target: number }>) => void, capture?: boolean): void
    
    addEventListener(type: string, listener: EventListener | EventListenerObject, useCapture?: boolean): void
}

/**
 * FlowyDiagram a webcomponent containing a canvas to manage diagram drawing
 * 
 * @tag &lt;flowy-diagram&gt;
 */
@customElement('flowy-diagram')
export class FlowyDiagram extends LitElement {

    // css seems doesn't work without shadow dom
    // static styles = css`
    // p {
    //   color: green;
    // }
    // `

    @query('#canvas')
    private _canvas!: HTMLCanvasElement;

    @query('.indicator')
    private _indicator!: HTMLElement;

    @property( { type: 'boolean'} )
    deleteUnlinkBlockOnDrag = false

    @property( { type: 'number'} )
    spacing_x = 20

    @property( { type: 'number'} )
    spacing_y = 80

    private load!: () => void

    /**
     * traverse the diagram and generate a JSON representation
     */
    output(): Output {

        const html_ser = this._canvas.innerHTML;
        const json_data: Output = {
            html: html_ser,
            blockarr: this.blocks,
            blocks: Array<BlockData>()
        };
        if (this.blocks.length > 0) {

            for (let i = 0; i < this.blocks.length; i++) {
                json_data.blocks.push({
                    id: this.blocks[i].id,
                    parent: this.blocks[i].parent,
                    data: [],
                    attr: []
                });
                let blockParent = this.#blockByValue(this.blocks[i].id)
                blockParent?.querySelectorAll("input").forEach(block => {
                    let json_name = block.getAttribute("name");
                    let json_value = block.value;
                    json_data.blocks[i].data.push({
                        name: json_name,
                        value: json_value
                    });
                });
                Array.prototype.slice.call(blockParent?.attributes).forEach(attribute => {
                    let jsonobj: Record<string, any> = {}
                    jsonobj[attribute.name] = attribute.value;
                    json_data.blocks[i].attr.push(jsonobj);
                });
            }
        }
        return json_data;
    }
    
    import( output:Output ) {

        this._canvas.innerHTML = output.html;
        for (let a = 0; a < output.blockarr.length; a++) {
            this.addDataBlock( output.blockarr[a] )
        }
        if (this.blocks.length > 1) {
            this.rearrangeMe();
            this.checkOffset();
        }
    }

    private checkOffset():void {
        const { left:canvas_left } = this._canvas.getBoundingClientRect()
        const { absx } = this.dragContext

        const offsetleftArr = this.blocks.map(a => a.x);
        const widths = this.blocks.map(a => a.width);
        const mathmin = offsetleftArr.map((item, index) => item - (widths[index] / 2))
        const offsetleft = Math.min.apply(Math, mathmin);

        if (offsetleft < (canvas_left + window.scrollX - absx)) {

            const blocko = this.blocks.map(a => a.id);
            
            for (let w = 0; w < this.blocks.length; w++) {

                const arrowblock = this.blocks.find(a => a.id == blocko[w])!

                this.#blockByValue(arrowblock.id).style.left = arrowblock.x - (arrowblock.width / 2) - offsetleft + canvas_left - absx + 20 + "px";
                
                if (arrowblock.parent != -1) {
                    const parentblock = this.blocks.find(a => a.id == arrowblock.parent)!
                    const arrowx = arrowblock.x - parentblock.x;
                    if (arrowx < 0) {
                        this.#arrowByValue(blocko[w]).style.left = ( arrowblock.x - offsetleft + 15 ) + canvas_left - absx + "px";
                    } else {
                        this.#arrowByValue(blocko[w]).style.left = ( parentblock.x - offsetleft ) + canvas_left - absx + "px";
                    }
                }
            }
            
            this.blocks.forEach( b => 
                b.x = (this.#blockByValue(b.id).getBoundingClientRect().left + window.scrollX) + 
                        (this._canvas.scrollLeft) + 
                        (parseInt(window.getComputedStyle(this.#blockByValue(b.id)).width) / 2) - 20 - canvas_left
            )
        }
    }

    /**
     * 
     */
    private rearrangeMe():void {
        const { _canvas: canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this
        const { absx } = this.dragContext

        let result = this.blocks.map(a => a.parent);
        for (let z = 0; z < result.length; z++) {
            if (result[z] == -1) {
                z++;
            }
            let totalwidth = 0;
            let totalremove = 0;

            const parent_blocks = this.blocks.filter(id => id.parent == result[z])

            for (let w = 0; w < parent_blocks.length; w++) {
                
                const children = parent_blocks[w];

                if (this.blocks.filter(id => id.parent == children.id).length == 0) {
                    children.childwidth = 0;
                }
                if (children.childwidth > children.width) {
                    if (w == parent_blocks.length - 1) {
                        totalwidth += children.childwidth;
                    } else {
                        totalwidth += children.childwidth + paddingx;
                    }
                } else {
                    if (w == parent_blocks.length - 1) {
                        totalwidth += children.width;
                    } else {
                        totalwidth += children.width + paddingx;
                    }
                }
            }

            const r_array = this.blocks.filter(id => id.id == result[z])!

            if (result[z] != -1) {
                r_array[0].childwidth = totalwidth;
            }

            for (let w = 0; w < parent_blocks.length; w++) {
                
                const children = parent_blocks[w];

                const r_block = this.#blockByValue(children.id)
                
                if (children.childwidth > children.width) {
                    r_block.style.left = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                    children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                    totalremove += children.childwidth + paddingx;
                } else {
                    r_block.style.left = r_array[0].x - (totalwidth / 2) + totalremove - (absx + window.scrollX) + canvas_div.getBoundingClientRect().left + "px";
                    children.x = r_array[0].x - (totalwidth / 2) + totalremove + (children.width / 2);
                    totalremove += children.width + paddingx;
                }

                let arrowblock = this.blocks.find(a => a.id == children.id)!
                let arrowx = arrowblock.x - this.blocks.find(a => a.id == children.parent)!.x + 20
                let arrowy = paddingy
                this.updateArrow(arrowblock, arrowx, arrowy, children)
            }
        }
    }

    //
    // BLOCK SECTION
    //

    private blocks = Array<Block>();

    addDataBlockFromElement( block: HTMLElement, data?: Partial<Block>   ) {
        const { width: block_width, height: block_height } = window.getComputedStyle(block)
        const { left: block_left, top: block_top } = block.getBoundingClientRect()
        const { left, top } = this._canvas.getBoundingClientRect()
        const { scrollLeft, scrollTop } = this._canvas
        const { scrollX, scrollY } = window

        const b = {
            parent: -1,
            childwidth: 0,
            id: blockIdNumber(block),
            x: (block_left + scrollX) + (parseInt(block_width) / 2) + scrollLeft - left,
            y: (block_top + scrollY) + (parseInt(block_height) / 2) + scrollTop - top,
            width: parseInt(block_width),
            height: parseInt(block_height),
            ...data
        }

        this.blocks.push( b )

    }

    addDataBlock( data: Block   ) {

        this.blocks.push( data )

        return data

    }

    private get nexBlockId() {

        if (this.blocks.length === 0) {
            return `block0`
        } 

        const max = this.blocks.reduce((result, a) => Math.max(result, a.id), 0)

        return `block${max + 1}`
        
    }

    private snap!:( ctx: Pick<DragContext,  'element' | 'rearrange' | 'absx' | 'absy' | 'blockstemp' >, blockIndex: number, blocko: Array<number>) => void

    public debugAddLinkedBlock( template:HTMLElement, blockToAttach:HTMLElement ) {

        if(this.blocks.length === 0) { 
            throw 'error because it is a first block on the diagram!'
        }

        const interval = setInterval( () => {
            const bid = blockIdNumber(blockToAttach)

            const block_index = this.blocks.findIndex( b => bid === b.id )
            if( block_index == -1 ) return
    
            clearInterval( interval )
            
            template.setAttribute( 'id', this.nexBlockId)
            
            const blocko = this.blocks.map(a => a.id)

            const ctx = {
                element: template,
                rearrange : false,
                absx: 0, absy: 0,
                blockstemp: []
            }

            // const blocka = this.blocks[block_index]
            // if (this.blockSnap(template, false, this.#blockByValue( blocka.id))) {
                this.snap( ctx, block_index, blocko)
            // }

        }, 100)


    }

    /**
     * 
     * @param value 
     * @returns 
     */
    #blockByValue(value: number | string) {
        return document.getElementById( `block${value}`) as HTMLElement
    }

    /**
    * deleteBlocks
    *  
    */
    deleteBlocks() {
        this.blocks = [];
        this._canvas.innerHTML = "<div class='indicator invisible'></div>";
    }

    private blockGrabbed(block: HTMLElement) {
        const event = new CustomEvent<HTMLElement>('templateGrabbed', {
            detail: block
        })
        this.dispatchEvent(event)
    }

    private blockReleased( block: HTMLElement ) {
        const event = new CustomEvent<HTMLElement>('templateReleased', {
            detail: block
        })
        this.dispatchEvent(event)
    }

    private blockSnap(drag: HTMLElement, first: boolean, parent?: HTMLElement) {
        const event = new CustomEvent<{target: HTMLElement, parent?: HTMLElement}>('snapping', {
            detail: { target:drag, parent: parent },
            cancelable: true
        })
        return this.dispatchEvent(event)
    }
    
    private blockMove(drag: HTMLElement, target: Block) {
        const event = new CustomEvent<{ source:HTMLElement, target: number }>('moving', {
            detail: { source: drag, target: target.id },
            cancelable: true
        })
        return this.dispatchEvent(event)
    }

    //////////////////////////////////////////////////////
    //
    // ARROW SECTION
    //
    //////////////////////////////////////////////////////

    /**
     * 
     * @param value 
     * @returns 
     */
    #arrowByValue(value: number | string) {
        return document.getElementById( `arrow${value}`) as HTMLElement
    }
    
    /**
     * 
     * @param el 
     * @param arrow 
     * @param x 
     * @param y 
     * @param parent 
     */
    private drawArrow( el:HTMLElement, arrow: Block, x: number, y: number, parent: number):void {
        const { absx } = this.dragContext
        const parent_id = `block${parent}`
        
        // TODO MOVE SETTING OF DRAG PARENT OUT OF THIS METHOD
        el.setAttribute( 'parent', parent_id )

        const { _canvas: canvas_div, spacing_y:paddingy } = this;

        const parent_block = this.blocks.find(a => a.id == parent)!
        const drag_id = blockIdNumber(el)

        const adjustment = (absx + window.scrollX) - canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left
       
        let arrow_element:HTMLElement 

        if (x < 0) {

            arrow_element = createOrUpdateArrow(drag_id, 5, y, paddingy, parent_block.x - arrow.x + 5 ) 
            arrow_element.setAttribute( "source", parent_id)
            arrow_element.setAttribute( "target", `block${drag_id}`)
            canvas_div.appendChild(arrow_element)
            arrow_element.style.left = `${arrow.x - 5 - adjustment}px`

        } else {

            arrow_element = createOrUpdateArrow(drag_id, x, y, paddingy)
            arrow_element.setAttribute( "source", parent_id)
            arrow_element.setAttribute( "target", `block${drag_id}`)
            canvas_div.appendChild(arrow_element)
            arrow_element.style.left = `${parent_block.x - 20 - adjustment}px`

        }

        arrow_element.style.top = `${parent_block.y + (parent_block.height / 2) + canvas_div.getBoundingClientRect().top - this.dragContext.absy}px`
    }

    /**
     * 
     * @param arrow 
     * @param x 
     * @param y 
     * @param children 
     */
    private updateArrow(arrow: Block, x: number, y: number, children: Block):void {

        const { _canvas: canvas_div, spacing_y:paddingy } = this

        const _source_block = this.blocks.find(a => a.id == children.parent)!
        const el = this.#arrowByValue(children.id)

        const adjustment = (this.dragContext.absx + window.scrollX) - canvas_div.getBoundingClientRect().left

        if (x < 0) {

            createOrUpdateArrow( el, 5, y, paddingy, _source_block.x - arrow.x + 5 )
            el.style.left = `${arrow.x - 5 - adjustment}px`

        } else {

            createOrUpdateArrow( el, x, y, paddingy )
            el.style.left = `${_source_block.x - 20 - adjustment}px` 

        }
    }

    //////////////////////////////////////////////////////
    //
    // DRAG SECTION
    //
    //////////////////////////////////////////////////////

    private dragContext:DragContext = {
        element: null, // currently dragegd element
        original: null,
        rearrange: false,
        active: false,
        dragblock: false,
        prevblock: 0,            
        blockstemp: Array<Block>(),
        dragx: 0,
        dragy: 0,
        mouse_x: 0,
        mouse_y: 0,
        absx: 0,
        absy:0,
    }

    private beginDrag!: (event: any) => void
    private endDrag!: (event: any) => void
    private moveBlock!: (event: any) => void
    private touchblock!: (event: any) => void

    private checkAttach( block: HTMLElement, id: number) { 

        const { _canvas: canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this;

        const b = this.blocks.find( a => a.id == id  )!
        console.assert( b!==undefined, `blocks[${id}] not found!`)

        const xpos = (block.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(block).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
        const ypos = (block.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
        
        if (xpos >= b.x - (b.width / 2) - paddingx && xpos <= b.x + (b.width / 2) + paddingx && ypos >=b.y - (b.height / 2) && ypos <= b.y + b.height) {
            return true;
        } 
        
        return false;
        
    }

    private addBlockElement( ctx: Pick<DragContext,  'element' | 'rearrange' > ):void {

        const { element: drag } = ctx

        if( !drag ) throw 'drag element not valid!'

        this._canvas.appendChild(drag)

        drag.addEventListener("click", (e) => {

            // guard 
            const skip = ( ctx.rearrange /* && drag.classList.contains('dragging')*/ )

            drag.classList.remove('dragging')
            ctx.rearrange = false

            if( skip ) return

            const event = new CustomEvent<HTMLElement>('blockSelected', {
                detail: drag
            })
            this.dispatchEvent(event)
    
        })

    }

    removeSelection( ctx: Pick<DragContext, 'element'> ): void {

        if( !ctx.element ) return // GUARD

        this._canvas.appendChild(this._indicator)

        ctx.element.parentNode?.removeChild(ctx.element)
    }

  
    /**
     * disable shadow root
     * 
     * @returns 
     * @see [How to create LitElement without Shadow DOM?](https://stackoverflow.com/a/55213037/521197)
     */
    createRenderRoot() {
        return this;
    }

    connectedCallback() {
        super.connectedCallback()
    }

    protected render() {
        return html`<div id="canvas">`
    }
 
    /**
     * lit component lifecycle
     * 
     */
    protected firstUpdated() {

        let loaded = false

        this.load = () => {
            // GUARD
            if (loaded) return 

            loaded = true;

            const { _canvas: canvas_div, spacing_x:paddingx, spacing_y:paddingy } = this;
            
            if (window.getComputedStyle(canvas_div).position == "absolute" || window.getComputedStyle(canvas_div).position == "fixed") {
                this.dragContext.absx = canvas_div.getBoundingClientRect().left;
                this.dragContext.absy = canvas_div.getBoundingClientRect().top;
            }

            // indicator
            const el = document.createElement("DIV");
            el.classList.add('indicator');
            el.classList.add('invisible');
            canvas_div.appendChild(el);

            this.beginDrag = (event:UIEvent) => {

                const { position } = window.getComputedStyle(canvas_div)

                if (position == "absolute" || position == "fixed") {

                    const { left, top } =  canvas_div.getBoundingClientRect()
                    this.dragContext.absx = left;
                    this.dragContext.absy = top;
                }

                if ('targetTouches' in event && event.targetTouches) {

                    const { clientX, clientY } = (<TouchEvent>event).changedTouches[0]
                    this.dragContext.mouse_x = clientX
                    this.dragContext.mouse_y = clientY
                
                } else {

                    const { clientX, clientY } = event as MouseEvent
                    this.dragContext.mouse_x = clientX
                    this.dragContext.mouse_y = clientY
                }

                const target = event.target as HTMLElement 

                const item = target.closest(".create-flowy") as HTMLElement

                if ( item && !isRightClick(event) ) {
                    
                    this.dragContext.original = item

                    let newNode = item.cloneNode(true) as HTMLElement;

                    item.classList.add("dragnow");
                    newNode.classList.add("block");
                    newNode.classList.remove("create-flowy");

                    newNode.setAttribute( 'id', this.nexBlockId )
                    document.body.appendChild(newNode);
                    
                    this.dragContext.element = newNode

                    this.blockGrabbed(item);

                    this.dragContext.element.classList.add("dragging");

                    this.dragContext.active = true;

                    const { left , top } = item.getBoundingClientRect()

                    this.dragContext.dragx = this.dragContext.mouse_x - left
                    this.dragContext.dragy = this.dragContext.mouse_y - top

                    this.dragContext.element.style.left = this.dragContext.mouse_x - this.dragContext.dragx + "px";
                    this.dragContext.element.style.top = this.dragContext.mouse_y - this.dragContext.dragy + "px";
                }
            }

            this.moveBlock = (event:UIEvent) => {

                const { element: drag } = this.dragContext

                if( !drag ) return // GUARD

                if ('targetTouches' in event && event.targetTouches) {

                    const { clientX, clientY } = (<TouchEvent>event).changedTouches[0]
                    this.dragContext.mouse_x = clientX
                    this.dragContext.mouse_y = clientY

                } else {

                    const { clientX, clientY } = event as MouseEvent
                    this.dragContext.mouse_x = clientX
                    this.dragContext.mouse_y = clientY

                }

                if (this.dragContext.dragblock) {

                    this.dragContext.rearrange = true;
                    drag.classList.add("dragging");
                    
                    const blockid = blockIdNumber( drag );
                    
                    const prev_block = this.blocks.find(a => a.id == blockid)!
                    console.assert( prev_block!==undefined, "prev block not found!" )

                    this.dragContext.prevblock = prev_block.parent;
                    
                    this.dragContext.blockstemp.push(prev_block);
                    
                    this.blocks = this.blocks.filter(e => e.id != blockid)

                    if (blockid != 0) {
                        this.#arrowByValue(blockid).remove();
                    }

                    let layer = this.blocks.filter(a => a.parent == blockid);

                    let flag = false;
                    let foundids = Array<number>()
                    let allids = Array<number>()
                    
                    while (!flag) {

                        layer.filter( l => l.id != blockid ).map( l => l.id ).forEach( lid => {

                            const block = this.blocks.find(a => a.id == lid )!
                            console.assert( block!==undefined, `block[${lid}] not found!` )

                            this.dragContext.blockstemp.push( block );
                            const blockParent = this.#blockByValue(lid)
                            const arrowParent = this.#arrowByValue(lid)
                            
                            blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (drag.getBoundingClientRect().left + window.scrollX) + "px";
                            blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (drag.getBoundingClientRect().top + window.scrollY) + "px";
                            arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (drag.getBoundingClientRect().left + window.scrollX) + "px";
                            arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (drag.getBoundingClientRect().top + window.scrollY) + "px";
                            
                            drag.appendChild(blockParent);
                            drag.appendChild(arrowParent);
                            
                            foundids.push(lid)
                            allids.push(lid)

                        })
                        if (foundids.length == 0) {
                            flag = true;
                        } else {
                            layer = this.blocks.filter(a => foundids.includes(a.parent));
                            foundids = [];
                        }
                    }


                    for (let i = 0; i < this.blocks.filter(a => a.parent == blockid).length; i++) {

                        let blocknumber = this.blocks.filter(a => a.parent == blockid)[i].id;
                        this.blocks = this.blocks.filter(e => e.id != blocknumber)
                    }

                    for (let i = 0; i < allids.length; i++) {

                        let blocknumber = allids[i];
                        this.blocks = this.blocks.filter(e => e.id != blocknumber)
                    }

                    if (this.blocks.length > 1) {
                        this.rearrangeMe();
                    }

                    this.dragContext.dragblock = false;
                }


                if (this.dragContext.active) {
                    
                    drag.style.left = this.dragContext.mouse_x - this.dragContext.dragx + "px";
                    drag.style.top = this.dragContext.mouse_y - this.dragContext.dragy + "px";

                } else if (this.dragContext.rearrange) {
                    
                    drag.style.left = this.dragContext.mouse_x - this.dragContext.dragx - (window.scrollX + this.dragContext.absx) + canvas_div.scrollLeft + "px";
                    drag.style.top = this.dragContext.mouse_y - this.dragContext.dragy - (window.scrollY + this.dragContext.absy) + canvas_div.scrollTop + "px";
                    const b = this.dragContext.blockstemp.find(a => a.id == blockIdNumber( drag ))!
                    b.x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft;
                    b.y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop;
                }

                if (this.dragContext.active || this.dragContext.rearrange) {
                    
                    const _rect = canvas_div.getBoundingClientRect()

                    if (this.dragContext.mouse_x > _rect.width + _rect.left - 10 && this.dragContext.mouse_x < _rect.width + _rect.left + 10) {
                        canvas_div.scrollLeft += 10;
                    } else if (this.dragContext.mouse_x < _rect.left + 10 && this.dragContext.mouse_x > _rect.left - 10) {
                        canvas_div.scrollLeft -= 10;
                    } else if (this.dragContext.mouse_y > _rect.height + _rect.top - 10 && this.dragContext.mouse_y < _rect.height + _rect.top + 10) {
                        canvas_div.scrollTop += 10;
                    } else if (this.dragContext.mouse_y < _rect.top + 10 && this.dragContext.mouse_y > _rect.top - 10) {
                        canvas_div.scrollLeft -= 10;
                    }
                    
                    const blocka = this.blocks.find( b => this.checkAttach( drag, b.id ) )
                    if( blocka ) {
                        const block = this.#blockByValue(blocka.id)

                        block.appendChild(this._indicator);
                        this._indicator.style.left = (block.offsetWidth / 2) - 5 + "px";
                        this._indicator.style.top = block.offsetHeight + "px";
                        this._indicator.classList.remove("invisible");
                    }
                    else {
                        if (!this._indicator.classList.contains("invisible")) {
                            this._indicator.classList.add("invisible");
                        }
                    }
                    
                }
            }

            this.endDrag = (event:UIEvent) => {
                const { element: drag, original } = this.dragContext

                if( !drag ) return // GUARD
                if( !original ) return // GUARD

                // GUARD
                if( isRightClick(event) ) return
                if( !(this.dragContext.active || this.dragContext.rearrange) ) return
            
                this.dragContext.dragblock = false;

                this.blockReleased( original );
                
                if (!this._indicator.classList.contains("invisible")) {
                    this._indicator.classList.add("invisible");
                }
                
                // ACTIVE STRATEGY
                if (this.dragContext.active) {
                    
                    original.classList.remove("dragnow");
                    drag.classList.remove("dragging");

                    if(this.blocks.length === 0) {

                        const { top:drag_top, left:drag_left } = drag.getBoundingClientRect()
                        const { top:canvas_top, left:canvas_left } = canvas_div.getBoundingClientRect()

                        if ((drag_top + window.scrollY) > (canvas_top + window.scrollY) && (drag_left + window.scrollX) > (canvas_left + window.scrollX)) {
                            dropFirstBlock( this.dragContext )
                        }
                        else {
                            this.removeSelection( this.dragContext ) 
                        }
                        return
                    }

                    const block_index = this.blocks.findIndex( b => this.checkAttach( drag, b.id ) )
                    if( block_index != -1 ) {
                        this.dragContext.active = false

                        const blocka = this.blocks[block_index]

                        if (this.blockSnap(drag, false, this.#blockByValue( blocka.id))) {
                            const blocko = this.blocks.map(a => a.id)
                            this.snap(this.dragContext, block_index, blocko)
                        } else {
                            this.dragContext.active = false
                            this.removeSelection( this.dragContext ) 
                        }
                    }
                    else {
                        this.dragContext.active = false
                        this.removeSelection( this.dragContext ) 
                    }

                }
                
                // REARRANGE STRATEGY
                if ( this.dragContext.rearrange  ) {

                    if( blockIdNumber( drag ) === 0 ) {
                        rearrangeFirstBlock( this.dragContext )
                        return
                    }

                    const rejectDrop = () => {
                        const ii = blocko.indexOf(this.dragContext.prevblock)
                        this.snap( this.dragContext, ii, blocko);
                    }

                    const blocko = this.blocks.map(a => a.id);

                    for (let i = 0; i < this.blocks.length; i++) {
                        if ( this.checkAttach( drag, blocko[i])) {
                            this.dragContext.active = false;

                            const b = this.blocks.find(id => id.id == blocko[i])! 
                            console.assert( b!==undefined, `block ${blocko[i]} not found!` )

                            if (this.blockMove(drag, b) ) {
                                 this.snap(this.dragContext, i, blocko);
                            }
                            else {
                                rejectDrop()
                            }
                            break;
                        } 
                        else if (i == this.blocks.length - 1) {
                    
                            if( this.deleteUnlinkBlockOnDrag ) {
                                this.dragContext.rearrange = false;
                                this.dragContext.blockstemp = [];
                                this.dragContext.active = false;
                                this.removeSelection( this.dragContext ) 
                                break;
                            }
                            else {
                            
                                this.dragContext.active = false;
                                rejectDrop()
                                break;
                            }
                            
                        }
                    }
                } 
                                
            }

            const dropFirstBlock = ( ctx: Pick<DragContext, 'element' | 'absy' | 'absx' | 'active' | 'rearrange'>) => {

                const { element: block, absy, absx } = this.dragContext
                if( !block ) return // GUARD

                this.blockSnap(block, true, undefined)

                ctx.active = false;
                
                block.style.top = (block.getBoundingClientRect().top + window.scrollY) - (absy + window.scrollY) + canvas_div.scrollTop + "px";
                block.style.left = (block.getBoundingClientRect().left + window.scrollX) - (absx + window.scrollX) + canvas_div.scrollLeft + "px";
                
                this.addBlockElement( ctx )

                this.addDataBlockFromElement( block )
            }

            const rearrangeFirstBlock = ( ctx: Pick<DragContext, 'element' | 'blockstemp' |'absx' | 'absy'>) => {

                const { element: block, absx, absy  } = ctx
                if( !block ) return // GUARD

                for (let w = 0; w < ctx.blockstemp.length; w++) {
                    if (ctx.blockstemp[w].id != blockIdNumber( block )) {
                        const blockParent = this.#blockByValue(ctx.blockstemp[w].id)
                        const arrowParent = this.#arrowByValue(ctx.blockstemp[w].id)
                        blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX) + canvas_div.scrollLeft - 1 - absx + "px";
                        blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY) + canvas_div.scrollTop - absy - 1 + "px";
                        arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX) + canvas_div.scrollLeft - absx - 1 + "px";
                        arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) + canvas_div.scrollTop - 1 - absy + "px";
                        canvas_div.appendChild(blockParent);
                        canvas_div.appendChild(arrowParent);
                        ctx.blockstemp[w].x = (blockParent.getBoundingClientRect().left + window.scrollX) + (toInt(blockParent.offsetWidth) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left - 1;
                        ctx.blockstemp[w].y = (blockParent.getBoundingClientRect().top + window.scrollY) + (toInt(blockParent.offsetHeight) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top - 1;
                    }
                }

                const block_temp = this.dragContext.blockstemp.find(a => a.id == 0)!

                block_temp.x = (block.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(block).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                block_temp.y = (block.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(block).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
                
                this.blocks = this.blocks.concat(ctx.blockstemp);
                ctx.blockstemp = [];
            }

            this.snap = ( ctx: Pick<DragContext,  'element' | 'rearrange' | 'absx' | 'absy' | 'blockstemp' >, blockIndex: number, blocko: Array<number>) => {
                
                const { element: drag } = ctx
                if( !drag ) return // GUARD

                if (!ctx.rearrange) {
                    this.addBlockElement( ctx )
                }
                
                const block = this.blocks.find(a => a.id == blocko[blockIndex])!
                const block_parent = this.blocks.find(id => id.parent == blocko[blockIndex])!
                const children_blocks = this.blocks.filter(id => id.parent == blocko[blockIndex])

                let totalremove = 0;
                let totalwidth = children_blocks
                    .map( children => Math.max( children.childwidth, children.width ))
                    .reduce( (result, width ) => result + width + paddingx, 0 )

                totalwidth += parseInt(window.getComputedStyle(drag).width);
  
                children_blocks.forEach( children => {

                    if (children.childwidth > children.width) {
                        this.#blockByValue(children.id).style.left = block.x - (totalwidth / 2) + totalremove + (children.childwidth / 2) - (children.width / 2) + "px";
                        children.x = block_parent.x - (totalwidth / 2) + totalremove + (children.childwidth / 2);
                        totalremove += children.childwidth + paddingx;
                    } else {
                        this.#blockByValue(children.id).style.left = block.x - (totalwidth / 2) + totalremove + "px";
                        children.x = block_parent.x - (totalwidth / 2) + totalremove + (children.width / 2);
                        totalremove += children.width + paddingx;
                    }

                })

                drag.style.left = block.x - (totalwidth / 2) + totalremove - (window.scrollX + ctx.absx) + canvas_div.scrollLeft + canvas_div.getBoundingClientRect().left + "px";
                drag.style.top = block.y + (block.height / 2) + paddingy - (window.scrollY + ctx.absy) + canvas_div.getBoundingClientRect().top + "px";
                
                if (ctx.rearrange) {

                    const drag_block = ctx.blockstemp.find(a => a.id == blockIdNumber(drag))!
                    drag_block.x = (drag.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(drag).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                    drag_block.y = (drag.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(drag).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;
                    drag_block.parent = blocko[blockIndex]

                    ctx.blockstemp.filter( b => b.id != blockIdNumber(drag) ).forEach( b => {

                        const blockParent = this.#blockByValue(b.id)
                        const arrowParent = this.#arrowByValue(b.id)
                        blockParent.style.left = (blockParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX + canvas_div.getBoundingClientRect().left) + canvas_div.scrollLeft + "px";
                        blockParent.style.top = (blockParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY + canvas_div.getBoundingClientRect().top) + canvas_div.scrollTop + "px";
                        arrowParent.style.left = (arrowParent.getBoundingClientRect().left + window.scrollX) - (window.scrollX + canvas_div.getBoundingClientRect().left) + canvas_div.scrollLeft + 20 + "px";
                        arrowParent.style.top = (arrowParent.getBoundingClientRect().top + window.scrollY) - (window.scrollY + canvas_div.getBoundingClientRect().top) + canvas_div.scrollTop + "px";
                        canvas_div.appendChild(blockParent);
                        canvas_div.appendChild(arrowParent);

                        b.x = (blockParent.getBoundingClientRect().left + window.scrollX) + (parseInt(window.getComputedStyle(blockParent).width) / 2) + canvas_div.scrollLeft - canvas_div.getBoundingClientRect().left;
                        b.y = (blockParent.getBoundingClientRect().top + window.scrollY) + (parseInt(window.getComputedStyle(blockParent).height) / 2) + canvas_div.scrollTop - canvas_div.getBoundingClientRect().top;

                    })

                    this.blocks = this.blocks.concat(ctx.blockstemp);
                    ctx.blockstemp = [];

                } else {

                    this.addDataBlockFromElement( drag, { parent: blocko[blockIndex] } )

                }

                const arrowblock = this.blocks.find(a => a.id == blockIdNumber( drag ))!
                const arrowx = arrowblock.x - block.x + 20;
                const arrowy = paddingy;
                
                this.drawArrow( drag, arrowblock, arrowx, arrowy, blocko[blockIndex]);

                if (block.parent != -1) {

                    let idval = blocko[blockIndex];
                    let bblocks = this.blocks.filter(a => a.id == idval)

                    while (true) {

                        if (bblocks[0].parent == -1) {
                            break
                        } 

                        let zwidth = 0;
                        bblocks.forEach( (children, w) => {

                            const bb = this.blocks.filter(id => id.parent == idval)

                            const width = Math.max(children.childwidth, children.width)

                            zwidth += (w == bb.length - 1) ? width : width + paddingx 

                        })

                        bblocks[0].childwidth = zwidth;
                        idval = bblocks[0].parent;
                        bblocks = this.blocks.filter(a => a.id == idval)

                    }
                    bblocks[0].childwidth = totalwidth;
                }

                this.rearrangeMe();
                this.checkOffset();
            }

            this.touchblock = (event: any) => {

                this.dragContext.dragblock = false;

                if (hasParentClass(event.target, "block")) {
                    const theblock = event.target.closest(".block");

                    if (event.targetTouches) {
                        this.dragContext.mouse_x = event.targetTouches[0].clientX;
                        this.dragContext.mouse_y = event.targetTouches[0].clientY;
                    } else {
                        this.dragContext.mouse_x = event.clientX;
                        this.dragContext.mouse_y = event.clientY;
                    }
                    
                    if (event.type !== "mouseup" ) {
                        if (event.which != 3) {
                            if (!this.dragContext.active && !this.dragContext.rearrange) {
                                this.dragContext.dragblock = true;
                                this.dragContext.element = theblock;
                                if( theblock ) {
                                    this.dragContext.dragx = this.dragContext.mouse_x - (theblock.getBoundingClientRect().left + window.scrollX);
                                    this.dragContext.dragy = this.dragContext.mouse_y - (theblock.getBoundingClientRect().top + window.scrollY);
                                }
                            }
                        }
                    }
                }
            }


            document.addEventListener("mousedown", this.beginDrag);
            document.addEventListener("mousedown", this.touchblock, false);
            document.addEventListener("touchstart", this.beginDrag);
            document.addEventListener("touchstart", this.touchblock, false);

            document.addEventListener("mouseup", this.touchblock, false);
            document.addEventListener("mousemove", this.moveBlock, false);
            document.addEventListener("touchmove", this.moveBlock, false);

            document.addEventListener("mouseup", this.endDrag, false);
            document.addEventListener("touchend", this.endDrag, false);
        }

        this.load();
    }
}
