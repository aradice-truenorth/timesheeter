const VerticalContent: React.FunctionComponent<{children: React.ReactNode}> = (props) => {
    return (
        <div className="flex flex-col content-evenly">{props.children}</div>
    )
}
export default VerticalContent;